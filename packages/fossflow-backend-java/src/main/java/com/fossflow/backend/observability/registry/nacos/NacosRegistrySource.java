package com.fossflow.backend.observability.registry.nacos;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fossflow.backend.observability.collector.JsonHttp;
import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.model.TagIds;
import com.fossflow.backend.observability.registry.RegistryCatalog;
import com.fossflow.backend.observability.registry.RegistryEdge;
import com.fossflow.backend.observability.registry.RegistryException;
import com.fossflow.backend.observability.registry.RegistryHealth;
import com.fossflow.backend.observability.registry.RegistryInstance;
import com.fossflow.backend.observability.registry.RegistryNode;
import com.fossflow.backend.observability.registry.RegistryQuery;
import com.fossflow.backend.observability.registry.RegistrySource;

/**
 * Nacos 注册中心承接层。
 *
 * 只做三件事：把 Nacos 的私有报文翻译成 RegistryCatalog、把 Nacos 的服务名
 * 归一成 svc.* 的 tagId、把失败降级成 warnings。所有 Nacos 专有知识
 * （路径、DEFAULT_GROUP@@ 前缀、health/readiness 语义）都限定在本类内。
 */
@Component
@ConditionalOnProperty(
        prefix = "fossflow.observability.registry.nacos",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class NacosRegistrySource implements RegistrySource {

    private static final Logger log = LoggerFactory.getLogger(NacosRegistrySource.class);

    /** Nacos 在实例报文里给服务名加了分组前缀，必须剥离子再进 TagIds */
    private static final String GROUP_SEPARATOR = "@@";

    private static final String EDGE_WARNING = "Nacos 只提供服务清单，不含调用关系";

    private static final Map<String, NodeKind> KIND_KEYWORDS = new LinkedHashMap<>();

    static {
        // 顺序即优先级：先判网关，再判存储与消息中间件
        KIND_KEYWORDS.put("gateway", NodeKind.GATEWAY);
        KIND_KEYWORDS.put("zuul", NodeKind.GATEWAY);
        KIND_KEYWORDS.put("apisix", NodeKind.GATEWAY);
        KIND_KEYWORDS.put("mysql", NodeKind.DATABASE);
        KIND_KEYWORDS.put("postgres", NodeKind.DATABASE);
        KIND_KEYWORDS.put("oracle", NodeKind.DATABASE);
        KIND_KEYWORDS.put("db", NodeKind.DATABASE);
        KIND_KEYWORDS.put("redis", NodeKind.CACHE);
        KIND_KEYWORDS.put("memcache", NodeKind.CACHE);
        KIND_KEYWORDS.put("kafka", NodeKind.MQ);
        KIND_KEYWORDS.put("rabbit", NodeKind.MQ);
        KIND_KEYWORDS.put("rocketmq", NodeKind.MQ);
        KIND_KEYWORDS.put("mq", NodeKind.MQ);
    }

    private final NacosProperties properties;

    public NacosRegistrySource(NacosProperties properties) {
        this.properties = properties;
    }

    @Override
    public String name() {
        return "nacos";
    }

    @Override
    public String displayName() {
        return "Nacos 注册中心";
    }

    @Override
    public RegistryHealth health() {
        try {
            JsonHttp.getText(baseUrl() + "/nacos/v1/console/health/readiness", timeout());

            return RegistryHealth.ok("readiness ok");
        } catch (RuntimeException error) {
            log.warn("[registry:nacos] readiness probe failed: {}", error.getMessage());

            // 详情回给前端时去掉内部地址，只说明结论
            return RegistryHealth.failed("readiness probe failed");
        }
    }

    @Override
    public RegistryCatalog fetch(RegistryQuery query) {
        RegistryQuery effective = query == null ? RegistryQuery.defaults() : query;
        String namespace = firstNonBlank(effective.namespace(), properties.getNamespace());
        String group = firstNonBlank(effective.group(), properties.getGroup());

        List<String> serviceNames;

        try {
            serviceNames = listServices(namespace, group);
        } catch (RuntimeException error) {
            throw new RegistryException(
                    "REGISTRY_UNAVAILABLE",
                    "cannot list services from " + displayName(),
                    error);
        }

        // 实例查询是多线程的，warnings 必须能安全并发追加
        List<String> warnings = Collections.synchronizedList(new ArrayList<>());
        warnings.add(EDGE_WARNING);

        List<RegistryNode> nodes = new ArrayList<>();

        Map<String, List<RegistryInstance>> instancesByService = effective.includeInstances()
                ? fetchInstances(serviceNames, namespace, group, warnings)
                : Map.of();

        for (String rawName : serviceNames) {
            String serviceName = stripGroupPrefix(rawName);

            if (serviceName.isEmpty()) {
                continue;
            }

            String tagId = TagIds.serviceTagId(serviceName);
            List<RegistryInstance> instances = instancesByService.getOrDefault(rawName, List.of());

            Map<String, String> labels = new LinkedHashMap<>();
            labels.put("group", group);
            labels.put("namespace", namespace);

            nodes.add(new RegistryNode(
                    tagId,
                    classify(serviceName),
                    serviceName,
                    summarize(instances, effective.includeInstances()),
                    labels,
                    instances));
        }

        return new RegistryCatalog(
                name(),
                Instant.now(),
                List.copyOf(nodes),
                List.<RegistryEdge>of(),
                List.copyOf(warnings));
    }

    /* ---------------------------- 服务列表 ---------------------------- */

    private List<String> listServices(String namespace, String group) {
        int pageSize = properties.getPageSize() <= 0 ? 500 : properties.getPageSize();

        String url = baseUrl() + "/nacos/v1/ns/service/list"
                + "?pageNo=1"
                + "&pageSize=" + pageSize
                + "&namespaceId=" + encode(namespace)
                + "&groupName=" + encode(group);

        JsonNode root = JsonHttp.get(url, timeout());
        JsonNode doms = root.path("doms");

        List<String> names = new ArrayList<>();

        if (doms.isArray()) {
            for (JsonNode dom : doms) {
                String value = dom.asText("");

                if (!value.isBlank()) {
                    names.add(value);
                }
            }
        }

        return names;
    }

    /* ---------------------------- 实例列表 ---------------------------- */

    /**
     * 并发查实例，信号量限流。单个服务失败只记 warning，不中断整次拉取：
     * 目录的价值在于「有哪些服务」，个别实例查不到不该让整页变空。
     */
    private Map<String, List<RegistryInstance>> fetchInstances(
            List<String> serviceNames,
            String namespace,
            String group,
            List<String> warnings) {

        Map<String, List<RegistryInstance>> result = new java.util.concurrent.ConcurrentHashMap<>();

        if (serviceNames.isEmpty()) {
            return result;
        }

        int concurrency = Math.max(1, properties.getInstanceConcurrency());
        int threads = Math.min(concurrency, serviceNames.size());
        Semaphore permits = new Semaphore(concurrency);

        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<CompletableFuture<Void>> tasks = new ArrayList<>();

        try {
            for (String rawName : serviceNames) {
                tasks.add(CompletableFuture.runAsync(() -> {
                    String serviceName = stripGroupPrefix(rawName);

                    try {
                        permits.acquire();

                        try {
                            result.put(rawName, listInstances(serviceName, namespace, group));
                        } finally {
                            permits.release();
                        }
                    } catch (InterruptedException error) {
                        Thread.currentThread().interrupt();
                        warnings.add("instance lookup interrupted for " + serviceName);
                    } catch (RuntimeException error) {
                        log.warn("[registry:nacos] instances failed for {}: {}",
                                serviceName, error.getMessage());
                        warnings.add("instance lookup failed for " + serviceName);
                    }
                }, pool));
            }

            CompletableFuture.allOf(tasks.toArray(CompletableFuture[]::new)).join();
        } finally {
            pool.shutdown();
        }

        return result;
    }

    private List<RegistryInstance> listInstances(
            String serviceName, String namespace, String group) {

        String url = baseUrl() + "/nacos/v1/ns/instance/list"
                + "?serviceName=" + encode(serviceName)
                + "&groupName=" + encode(group)
                + "&namespaceId=" + encode(namespace);

        JsonNode root = JsonHttp.get(url, timeout());
        JsonNode hosts = root.path("hosts");

        List<RegistryInstance> instances = new ArrayList<>();

        if (!hosts.isArray()) {
            return instances;
        }

        for (JsonNode host : hosts) {
            String ip = host.path("ip").asText("");
            int port = host.path("port").asInt(0);

            if (ip.isEmpty()) {
                continue;
            }

            boolean healthy = host.path("healthy").asBoolean(false);
            boolean enabled = host.path("enabled").asBoolean(true);
            boolean up = healthy && enabled;

            Double weight = host.path("weight").isNumber()
                    ? host.path("weight").asDouble()
                    : null;

            instances.add(new RegistryInstance(
                    port > 0 ? ip + ":" + port : ip,
                    up ? Health.HEALTHY.name() : Health.OFFLINE.name(),
                    weight));
        }

        return instances;
    }

    /* ---------------------------- 归一化 ---------------------------- */

    /** DEFAULT_GROUP@@msc-gateway → msc-gateway */
    static String stripGroupPrefix(String rawName) {
        if (rawName == null) {
            return "";
        }

        String trimmed = rawName.trim();
        int index = trimmed.lastIndexOf(GROUP_SEPARATOR);

        return index < 0 ? trimmed : trimmed.substring(index + GROUP_SEPARATOR.length()).trim();
    }

    /** 名称关键字分类，未知一律 SERVICE，避免把普通服务误判成中间件 */
    static NodeKind classify(String serviceName) {
        String lowered = serviceName == null ? "" : serviceName.toLowerCase(Locale.ROOT);

        for (Map.Entry<String, NodeKind> entry : KIND_KEYWORDS.entrySet()) {
            if (lowered.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        return NodeKind.SERVICE;
    }

    /** 无实例 → UNKNOWN；全健康 → HEALTHY；全挂 → OFFLINE；其余 WARNING */
    static Health summarize(List<RegistryInstance> instances, boolean instancesRequested) {
        if (!instancesRequested || instances.isEmpty()) {
            return Health.UNKNOWN;
        }

        long up = instances.stream()
                .filter(instance -> Health.HEALTHY.name().equals(instance.health()))
                .count();

        if (up == instances.size()) {
            return Health.HEALTHY;
        }

        return up == 0 ? Health.OFFLINE : Health.WARNING;
    }

    /* ---------------------------- 工具 ---------------------------- */

    private String baseUrl() {
        String raw = properties.getUrl() == null ? "" : properties.getUrl().trim();

        while (raw.endsWith("/")) {
            raw = raw.substring(0, raw.length() - 1);
        }

        return raw;
    }

    private Duration timeout() {
        long ms = properties.getTimeoutMs() <= 0 ? 5000 : properties.getTimeoutMs();

        return Duration.ofMillis(ms);
    }

    private static String encode(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static String firstNonBlank(String primary, String fallback) {
        return primary == null || primary.isBlank() ? fallback : primary;
    }
}
