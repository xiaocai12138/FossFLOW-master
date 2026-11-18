package com.fossflow.backend.observability.registry.nacos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.registry.RegistryCatalog;
import com.fossflow.backend.observability.registry.RegistryException;
import com.fossflow.backend.observability.registry.RegistryHealth;
import com.fossflow.backend.observability.registry.RegistryInstance;
import com.fossflow.backend.observability.registry.RegistryNode;
import com.fossflow.backend.observability.registry.RegistryQuery;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

/**
 * 用本地 HttpServer 回放 Nacos 真实形状的报文，验证承接层的翻译逻辑：
 * 前缀剥离、健康汇总、kind 分类、局部失败降级。不打桩内部方法，
 * 因此 URL 拼装与 JSON 解析链路也被覆盖。
 */
class NacosRegistrySourceTest {

    private HttpServer server;
    private String baseUrl;
    private NacosProperties properties;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();

        properties = new NacosProperties();
        properties.setUrl(baseUrl);
        properties.setTimeoutMs(3000);
        properties.setInstanceConcurrency(4);
        properties.setPageSize(500);
    }

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    /* ---------------------------- 工具 ---------------------------- */

    private NacosRegistrySource source() {
        return new NacosRegistrySource(properties);
    }

    private void route(String path, String body) {
        route(path, body, 200);
    }

    private void route(String path, String body, int status) {
        server.createContext(path, exchange -> respond(exchange, body, status));
    }

    private static void respond(HttpExchange exchange, String body, int status)
            throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);

        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static String serviceList(String... names) {
        StringBuilder doms = new StringBuilder();

        for (String name : names) {
            if (doms.length() > 0) {
                doms.append(',');
            }

            doms.append('"').append(name).append('"');
        }

        return "{\"count\":" + names.length + ",\"doms\":[" + doms + "]}";
    }

    private static String instances(String serviceName, boolean... healths) {
        StringBuilder hosts = new StringBuilder();

        for (int i = 0; i < healths.length; i++) {
            if (i > 0) {
                hosts.append(',');
            }

            hosts.append("{\"ip\":\"172.21.0.")
                    .append(10 + i)
                    .append("\",\"port\":9098,\"healthy\":")
                    .append(healths[i])
                    .append(",\"enabled\":true,\"weight\":1.0,")
                    .append("\"clusterName\":\"DEFAULT\",")
                    .append("\"serviceName\":\"DEFAULT_GROUP@@")
                    .append(serviceName)
                    .append("\",\"metadata\":{}}");
        }

        return "{\"name\":\"DEFAULT_GROUP@@" + serviceName + "\",\"hosts\":[" + hosts + "]}";
    }

    /* ---------------------- group 前缀剥离 ---------------------- */

    @Test
    @DisplayName("实例里的 DEFAULT_GROUP@@ 前缀会被剥离子再生成 svc.* tagId")
    void stripsGroupPrefixForTagId() {
        route("/nacos/v1/ns/service/list", serviceList("msc-gateway"));
        route("/nacos/v1/ns/instance/list", instances("msc-gateway", true));

        RegistryCatalog catalog = source().fetch(
                new RegistryQuery(null, null, true));

        assertThat(catalog.nodes()).hasSize(1);

        RegistryNode node = catalog.nodes().get(0);

        assertThat(node.tagId()).isEqualTo("svc.msc-gateway");
        assertThat(node.name()).isEqualTo("msc-gateway");
        assertThat(node.tagId()).doesNotContain("DEFAULT_GROUP");
        assertThat(node.tagId()).doesNotContain("@@");
    }

    @Test
    @DisplayName("stripGroupPrefix 对无前缀、带多段 @@、空白输入都安全")
    void stripGroupPrefixEdgeCases() {
        assertThat(NacosRegistrySource.stripGroupPrefix("DEFAULT_GROUP@@msc-gateway"))
                .isEqualTo("msc-gateway");
        assertThat(NacosRegistrySource.stripGroupPrefix("msc-gateway"))
                .isEqualTo("msc-gateway");
        assertThat(NacosRegistrySource.stripGroupPrefix("A@@B@@svc"))
                .isEqualTo("svc");
        assertThat(NacosRegistrySource.stripGroupPrefix("  OTHER@@  padded  "))
                .isEqualTo("padded");
        assertThat(NacosRegistrySource.stripGroupPrefix(null)).isEmpty();
        assertThat(NacosRegistrySource.stripGroupPrefix("")).isEmpty();
    }

    /* ---------------------- 健康汇总 ---------------------- */

    @Test
    @DisplayName("全部实例健康 → HEALTHY")
    void summarizeAllHealthy() {
        route("/nacos/v1/ns/service/list", serviceList("msc-business-service"));
        route("/nacos/v1/ns/instance/list", instances("msc-business-service", true, true));

        RegistryNode node = source().fetch(
                new RegistryQuery(null, null, true)).nodes().get(0);

        assertThat(node.health()).isEqualTo(Health.HEALTHY);
        assertThat(node.instances()).hasSize(2);
        assertThat(node.instances()).allSatisfy(
                instance -> assertThat(instance.health()).isEqualTo("HEALTHY"));
    }

    @Test
    @DisplayName("部分实例不健康 → WARNING")
    void summarizePartialHealthy() {
        route("/nacos/v1/ns/service/list", serviceList("msc-business-service"));
        route("/nacos/v1/ns/instance/list", instances("msc-business-service", true, false));

        RegistryNode node = source().fetch(
                new RegistryQuery(null, null, true)).nodes().get(0);

        assertThat(node.health()).isEqualTo(Health.WARNING);
        assertThat(node.instances()).extracting(RegistryInstance::health)
                .containsExactly("HEALTHY", "OFFLINE");
    }

    @Test
    @DisplayName("全部实例不健康 → OFFLINE")
    void summarizeAllDown() {
        route("/nacos/v1/ns/service/list", serviceList("msc-calculate-service"));
        route("/nacos/v1/ns/instance/list", instances("msc-calculate-service", false, false));

        RegistryNode node = source().fetch(
                new RegistryQuery(null, null, true)).nodes().get(0);

        assertThat(node.health()).isEqualTo(Health.OFFLINE);
    }

    @Test
    @DisplayName("服务无实例 → UNKNOWN，且不编造实例")
    void summarizeNoInstances() {
        route("/nacos/v1/ns/service/list", serviceList("msc-empty-service"));
        route("/nacos/v1/ns/instance/list", "{\"name\":\"DEFAULT_GROUP@@msc-empty-service\",\"hosts\":[]}");

        RegistryNode node = source().fetch(
                new RegistryQuery(null, null, true)).nodes().get(0);

        assertThat(node.health()).isEqualTo(Health.UNKNOWN);
        assertThat(node.instances()).isEmpty();
    }

    @Test
    @DisplayName("includeInstances=false 时不查实例，健康为 UNKNOWN")
    void skipsInstancesWhenNotRequested() {
        route("/nacos/v1/ns/service/list", serviceList("msc-gateway"));
        // 故意不注册 instance 路由：若实现仍去查就会失败并出现在 warnings
        route("/nacos/v1/ns/instance/list", "{\"hosts\":[]}");

        RegistryCatalog catalog = source().fetch(
                new RegistryQuery(null, null, false));

        assertThat(catalog.nodes().get(0).instances()).isEmpty();
        assertThat(catalog.nodes().get(0).health()).isEqualTo(Health.UNKNOWN);
        assertThat(catalog.warnings()).noneMatch(warning -> warning.contains("instance lookup failed"));
    }

    /* ---------------------- kind 分类 ---------------------- */

    @Test
    @DisplayName("kind 按名称关键字分类：网关/数据库/缓存/消息/普通服务")
    void classifiesKindsByKeyword() {
        route("/nacos/v1/ns/service/list", serviceList(
                "msc-gateway",
                "msc-order-db",
                "session-cache-redis",
                "event-kafka-bus",
                "msc-business-service"));
        route("/nacos/v1/ns/instance/list", instances("x", true));

        Map<String, NodeKind> kindByTag = new java.util.HashMap<>();

        for (RegistryNode node : source().fetch(
                new RegistryQuery(null, null, true)).nodes()) {
            kindByTag.put(node.tagId(), node.kind());
        }

        assertThat(kindByTag.get("svc.msc-gateway")).isEqualTo(NodeKind.GATEWAY);
        assertThat(kindByTag.get("svc.msc-order-db")).isEqualTo(NodeKind.DATABASE);
        assertThat(kindByTag.get("svc.session-cache-redis")).isEqualTo(NodeKind.CACHE);
        assertThat(kindByTag.get("svc.event-kafka-bus")).isEqualTo(NodeKind.MQ);
        assertThat(kindByTag.get("svc.msc-business-service")).isEqualTo(NodeKind.SERVICE);
    }

    @Test
    @DisplayName("classify 覆盖 zuul/apisix/postgres/oracle/memcache/rocketmq 等关键字")
    void classifiesExtraKeywords() {
        assertThat(NacosRegistrySource.classify("edge-zuul")).isEqualTo(NodeKind.GATEWAY);
        assertThat(NacosRegistrySource.classify("apisix-proxy")).isEqualTo(NodeKind.GATEWAY);
        assertThat(NacosRegistrySource.classify("pg-postgres-main")).isEqualTo(NodeKind.DATABASE);
        assertThat(NacosRegistrySource.classify("oracle-erp")).isEqualTo(NodeKind.DATABASE);
        assertThat(NacosRegistrySource.classify("memcache-session")).isEqualTo(NodeKind.CACHE);
        assertThat(NacosRegistrySource.classify("rocketmq-topic")).isEqualTo(NodeKind.MQ);
        assertThat(NacosRegistrySource.classify("rabbit-notify")).isEqualTo(NodeKind.MQ);
        assertThat(NacosRegistrySource.classify("plain-service")).isEqualTo(NodeKind.SERVICE);
        assertThat(NacosRegistrySource.classify("")).isEqualTo(NodeKind.SERVICE);
        assertThat(NacosRegistrySource.classify(null)).isEqualTo(NodeKind.SERVICE);
    }

    /* ---------------------- 局部失败降级 ---------------------- */

    @Test
    @DisplayName("单个服务查实例失败时仍返回其它服务，并把失败记入 warnings")
    void partialInstanceFailureKeepsOtherServices() {
        route("/nacos/v1/ns/service/list", serviceList("msc-gateway", "broken-service"));
        server.createContext("/nacos/v1/ns/instance/list", exchange -> {
            String query = exchange.getRequestURI().getQuery();

            if (query != null && query.contains("broken-service")) {
                respond(exchange, "{\"error\":\"boom\"}", 500);
                return;
            }

            respond(exchange, instances("msc-gateway", true), 200);
        });

        RegistryCatalog catalog = source().fetch(
                new RegistryQuery(null, null, true));

        assertThat(catalog.nodes()).hasSize(2);
        assertThat(catalog.nodes()).extracting(RegistryNode::tagId)
                .containsExactlyInAnyOrder("svc.msc-gateway", "svc.broken-service");

        RegistryNode gateway = catalog.nodes().stream()
                .filter(node -> node.tagId().equals("svc.msc-gateway"))
                .findFirst()
                .orElseThrow();

        assertThat(gateway.health()).isEqualTo(Health.HEALTHY);

        RegistryNode broken = catalog.nodes().stream()
                .filter(node -> node.tagId().equals("svc.broken-service"))
                .findFirst()
                .orElseThrow();

        assertThat(broken.health()).isEqualTo(Health.UNKNOWN);

        assertThat(catalog.warnings())
                .anyMatch(warning -> warning.contains("instance lookup failed for broken-service"));
    }

    @Test
    @DisplayName("服务列表为空时返回空 catalog，不抛错")
    void emptyServiceListReturnsEmptyCatalog() {
        route("/nacos/v1/ns/service/list", serviceList());

        RegistryCatalog catalog = source().fetch(
                new RegistryQuery(null, null, true));

        assertThat(catalog.nodes()).isEmpty();
        assertThat(catalog.edges()).isEmpty();
        assertThat(catalog.source()).isEqualTo("nacos");
        assertThat(catalog.fetchedAt()).isNotNull();
    }

    @Test
    @DisplayName("服务列表接口 500 时抛 RegistryException，消息不含内部地址")
    void serviceListFailureWrapsIntoRegistryException() {
        route("/nacos/v1/ns/service/list", "{\"error\":\"down\"}", 500);

        assertThatThrownBy(() -> source().fetch(new RegistryQuery(null, null, true)))
                .isInstanceOf(RegistryException.class)
                .hasMessageNotContaining("127.0.0.1")
                .hasMessageContaining("Nacos");
    }

    @Test
    @DisplayName("未知的 source 名字由 RegistryException.unknownSource 表达")
    void unknownSourceMessage() {
        RegistryException error = RegistryException.unknownSource("consul");

        assertThat(error.code()).isEqualTo("UNKNOWN_SOURCE");
        assertThat(error.getMessage()).contains("consul");
    }

    /* ---------------------- 契约不变式 ---------------------- */

    @Test
    @DisplayName("edges 始终为空，且 warnings 说明注册中心不含调用关系")
    void edgesEmptyWithWarning() {
        route("/nacos/v1/ns/service/list", serviceList("msc-gateway", "msc-business-service"));
        route("/nacos/v1/ns/instance/list", instances("x", true));

        RegistryCatalog catalog = source().fetch(
                new RegistryQuery(null, null, true));

        assertThat(catalog.edges()).isEmpty();
        assertThat(catalog.warnings()).anyMatch(warning -> warning.contains("不含调用关系"));
    }

    @Test
    @DisplayName("实例 id 用 ip:port，weight 原样透传")
    void instanceIdAndWeight() {
        route("/nacos/v1/ns/service/list", serviceList("msc-business-service"));
        route("/nacos/v1/ns/instance/list", instances("msc-business-service", true));

        RegistryInstance instance = source().fetch(
                new RegistryQuery(null, null, true)).nodes().get(0).instances().get(0);

        assertThat(instance.id()).isEqualTo("172.21.0.10:9098");
        assertThat(instance.weight()).isEqualTo(1.0);
    }

    @Test
    @DisplayName("namespace/group 缺省时回落到配置值，显式传入时覆盖配置")
    void namespaceAndGroupResolution() {
        properties.setNamespace("from-config-ns");
        properties.setGroup("from-config-group");

        List<String> seen = new java.util.concurrent.CopyOnWriteArrayList<>();

        route("/nacos/v1/ns/service/list", serviceList("msc-gateway"));
        server.createContext("/nacos/v1/ns/instance/list", exchange -> {
            seen.add(exchange.getRequestURI().getQuery());
            respond(exchange, instances("msc-gateway", true), 200);
        });

        source().fetch(new RegistryQuery(null, null, true));
        assertThat(seen).anyMatch(query -> query.contains("from-config-ns"));
        assertThat(seen).anyMatch(query -> query.contains("from-config-group"));

        seen.clear();
        source().fetch(new RegistryQuery("explicit-ns", "explicit-group", true));
        assertThat(seen).anyMatch(query -> query.contains("explicit-ns"));
        assertThat(seen).anyMatch(query -> query.contains("explicit-group"));
    }

    /* ---------------------- health ---------------------- */

    @Test
    @DisplayName("readiness 返回 200 → health ok")
    void healthOk() {
        route("/nacos/v1/console/health/readiness", "OK");

        RegistryHealth health = source().health();

        assertThat(health.ok()).isTrue();
        assertThat(health.detail()).contains("readiness ok");
    }

    @Test
    @DisplayName("readiness 非 200 → health failed，且不泄露内部地址")
    void healthFailed() {
        route("/nacos/v1/console/health/readiness", "DOWN", 503);

        RegistryHealth health = source().health();

        assertThat(health.ok()).isFalse();
        assertThat(health.detail()).doesNotContain("127.0.0.1");
    }

    @Test
    @DisplayName("源名与展示名固定为 nacos / Nacos 注册中心")
    void nameAndDisplayName() {
        assertThat(source().name()).isEqualTo("nacos");
        assertThat(source().displayName()).isEqualTo("Nacos 注册中心");
    }
}
