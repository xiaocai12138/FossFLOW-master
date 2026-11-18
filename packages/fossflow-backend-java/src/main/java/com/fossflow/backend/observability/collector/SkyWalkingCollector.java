package com.fossflow.backend.observability.collector;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fossflow.backend.observability.model.EdgeKind;
import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.model.TagIds;

/**
 * SkyWalking OAP 采集器：服务拓扑（架构图来源）+ Trace 明细。
 *
 * 对齐 OAP 9.4.0 的实际 GraphQL schema：
 *  - 服务列表是 getAllServices（旧文档里的 queryServices 在 9.x 已不存在）
 *  - 实例是 getServiceInstances
 *  - 最近链路是 queryBasicTraces
 * SkyWalking 不产出系统指标，指标交给 Prometheus。
 */
@Component
@ConditionalOnProperty(
        prefix = "fossflow.observability.skywalking",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class SkyWalkingCollector implements Collector {

    private static final Logger log = LoggerFactory.getLogger(SkyWalkingCollector.class);

    private static final DateTimeFormatter DURATION_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HHmm");

    private static final String TOPOLOGY_QUERY = """
            query GlobalTopology($duration: Duration!) {
              getGlobalTopology(duration: $duration) {
                nodes { id name type isReal }
                calls { source target }
              }
            }
            """;

    private static final String SERVICES_QUERY = """
            query Services($duration: Duration!) {
              services: getAllServices(duration: $duration) { id name }
            }
            """;

    private static final String INSTANCES_QUERY = """
            query Instances($serviceId: ID!, $duration: Duration!) {
              instances: getServiceInstances(serviceId: $serviceId, duration: $duration) {
                id name language
              }
            }
            """;

    private static final String TRACE_QUERY = """
            query Trace($traceId: ID!) {
              trace: queryTrace(traceId: $traceId) {
                spans {
                  spanId parentSpanId segmentId
                  serviceCode serviceInstanceName
                  startTime endTime endpointName isError
                  tags { key value }
                }
              }
            }
            """;

    private static final String TRACES_QUERY = """
            query Traces($condition: TraceQueryCondition) {
              traces: queryBasicTraces(condition: $condition) {
                traces { traceIds duration start isError endpointNames }
              }
            }
            """;

    private static final String PROBE_QUERY = "{ version }";

    private final String endpoint;
    private final String token;
    private final Duration timeout;
    private final ZoneId zoneId;
    private final long windowMinutes;
    private final int instanceServiceLimit;

    public SkyWalkingCollector(
            @Value("${fossflow.observability.skywalking.url:http://oap:12800}") String url,
            @Value("${fossflow.observability.skywalking.token:}") String token,
            @Value("${fossflow.observability.skywalking.timeout-ms:5000}") long timeoutMs,
            @Value("${fossflow.observability.skywalking.zone:Asia/Shanghai}") String zone,
            @Value("${fossflow.observability.skywalking.window-minutes:15}") long windowMinutes,
            @Value("${fossflow.observability.skywalking.instance-service-limit:50}")
            int instanceServiceLimit) {

        String base = url == null ? "" : url.trim();

        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        this.endpoint = base + "/graphql";
        this.token = token;
        this.timeout = Duration.ofMillis(timeoutMs);
        this.zoneId = ZoneId.of(zone);
        this.windowMinutes = windowMinutes;
        this.instanceServiceLimit = instanceServiceLimit;
    }

    @Override
    public String name() {
        return "skywalking";
    }

    @Override
    public Signal[] emissions() {
        return new Signal[] {Signal.GRAPH, Signal.TRACE};
    }

    /** 真实发一次 GraphQL 探测，确认 OAP 的查询链路可用 */
    @Override
    public HealthCheck health() {
        try {
            JsonNode data = post(PROBE_QUERY, Map.of());

            String version = data.path("version").asText("");

            return version.isBlank()
                    ? HealthCheck.ok("skywalking reachable at " + endpoint)
                    : HealthCheck.ok("skywalking " + version);
        } catch (RuntimeException error) {
            return HealthCheck.failed(error.getMessage());
        }
    }

    /* ----------------------------- 拓扑 ----------------------------- */

    @Override
    public GraphSnapshot collectGraph() {
        JsonNode data = post(TOPOLOGY_QUERY, Map.of("duration", durationWindow()));
        JsonNode topology = data.path("getGlobalTopology");

        if (topology.isMissingNode() || topology.isNull()) {
            return GraphSnapshot.empty();
        }

        Map<String, String> tagByOapId = new LinkedHashMap<>();
        List<NodeSnapshot> nodes = new ArrayList<>();

        for (JsonNode node : topology.path("nodes")) {
            String oapId = node.path("id").asText("");
            String nodeName = node.path("name").asText("");
            String type = node.path("type").asText("");
            boolean isReal = node.path("isReal").asBoolean(true);

            if (oapId.isEmpty() || nodeName.isEmpty()) {
                continue;
            }

            String tagId = TagIds.serviceTagId(nodeName);
            NodeKind kind = SkyWalkingNodeKinds.map(type, isReal);

            tagByOapId.put(oapId, tagId);

            Map<String, String> labels = new LinkedHashMap<>();
            labels.put("source", "skywalking");
            labels.put("swType", type);

            if (!isReal) {
                labels.put("conjectural", "true");
            }

            nodes.add(new NodeSnapshot(
                    tagId, kind, nodeName, null, labels, Health.HEALTHY));
        }

        List<EdgeSnapshot> edges = new ArrayList<>();

        for (JsonNode call : topology.path("calls")) {
            String fromTag = tagByOapId.get(call.path("source").asText(""));
            String toTag = tagByOapId.get(call.path("target").asText(""));

            if (fromTag == null || toTag == null || fromTag.equals(toTag)) {
                continue;
            }

            edges.add(new EdgeSnapshot(fromTag, toTag, EdgeKind.CALL, null, null, null));
        }

        return new GraphSnapshot(nodes, edges);
    }

    @Override
    public List<NodeSnapshot> collectInstances() {
        Map<String, String> window = durationWindow();

        JsonNode servicesData = post(SERVICES_QUERY, Map.of("duration", window));
        List<NodeSnapshot> nodes = new ArrayList<>();
        int queried = 0;

        for (JsonNode service : servicesData.path("services")) {
            if (queried >= instanceServiceLimit) {
                log.info("[skywalking] instance query capped at {} services", instanceServiceLimit);
                break;
            }

            String serviceId = service.path("id").asText("");
            String serviceName = service.path("name").asText("");

            if (serviceId.isEmpty() || serviceName.isEmpty()) {
                continue;
            }

            queried++;

            try {
                JsonNode instancesData = post(
                        INSTANCES_QUERY,
                        Map.of("serviceId", serviceId, "duration", window));

                String parentTag = TagIds.serviceTagId(serviceName);

                for (JsonNode instance : instancesData.path("instances")) {
                    String instanceName = instance.path("name").asText("");

                    if (instanceName.isEmpty()) {
                        continue;
                    }

                    Map<String, String> labels = new LinkedHashMap<>();
                    labels.put("source", "skywalking");
                    labels.put("language", instance.path("language").asText(""));

                    nodes.add(new NodeSnapshot(
                            TagIds.instanceTagId(serviceName, instanceName),
                            NodeKind.INSTANCE,
                            instanceName,
                            parentTag,
                            labels,
                            Health.HEALTHY));
                }
            } catch (RuntimeException error) {
                // 单个服务查实例失败不该拖垮整次同步
                log.warn("[skywalking] instances failed for {}: {}",
                        serviceName, error.getMessage());
            }
        }

        return nodes;
    }

    /* ----------------------------- 链路 ----------------------------- */

    @Override
    public TraceSnapshot collectTrace(String traceId, List<String> tagIds) {
        return fetchTrace(traceId);
    }

    @Override
    public List<TraceSnapshot> collectRecentTraces(int limit, List<String> tagIds) {
        int pageSize = limit <= 0 ? 10 : Math.min(limit, 50);

        Map<String, Object> condition = new LinkedHashMap<>();
        condition.put("queryDuration", durationWindow());
        condition.put("traceState", "ALL");
        condition.put("queryOrder", "BY_START_TIME");
        condition.put("paging", Map.of("pageNum", 1, "pageSize", pageSize));

        List<TraceSnapshot> traces = new ArrayList<>();

        try {
            JsonNode data = post(TRACES_QUERY, Map.of("condition", condition));
            Set<String> seen = new LinkedHashSet<>();

            for (JsonNode brief : data.path("traces").path("traces")) {
                for (JsonNode idNode : brief.path("traceIds")) {
                    String id = idNode.asText("");

                    if (!id.isEmpty() && seen.add(id)) {
                        TraceSnapshot trace = fetchTrace(id);

                        if (trace != null) {
                            traces.add(trace);
                        }
                    }

                    if (traces.size() >= pageSize) {
                        return traces;
                    }
                }
            }
        } catch (RuntimeException error) {
            log.warn("[skywalking] recent traces failed: {}", error.getMessage());
        }

        return traces;
    }

    private TraceSnapshot fetchTrace(String traceId) {
        if (traceId == null || traceId.isBlank()) {
            return null;
        }

        JsonNode data = post(TRACE_QUERY, Map.of("traceId", traceId.trim()));
        JsonNode spans = data.path("trace").path("spans");

        if (!spans.isArray() || spans.isEmpty()) {
            return null;
        }

        long baseTime = Long.MAX_VALUE;

        for (JsonNode span : spans) {
            baseTime = Math.min(baseTime, span.path("startTime").asLong(0));
        }

        List<SpanSnapshot> canonical = new ArrayList<>();

        for (JsonNode span : spans) {
            long start = span.path("startTime").asLong(0);
            long end = span.path("endTime").asLong(0);
            String serviceCode = span.path("serviceCode").asText("");
            int parentSpanId = span.path("parentSpanId").asInt(-1);

            canonical.add(new SpanSnapshot(
                    span.path("spanId").asText(""),
                    parentSpanId < 0 ? null : String.valueOf(parentSpanId),
                    TagIds.serviceTagId(serviceCode.isEmpty() ? "unknown" : serviceCode),
                    serviceCode.isEmpty() ? "unknown" : serviceCode,
                    span.path("endpointName").asText(""),
                    Math.max(0, start - baseTime),
                    Math.max(0, end - start),
                    span.path("isError").asBoolean(false) ? "ERROR" : "OK"));
        }

        canonical.sort(Comparator.comparingLong(SpanSnapshot::startMs));

        // 相邻同服务合并，path 即图上的高亮路径
        List<PathNode> path = new ArrayList<>();

        for (SpanSnapshot span : canonical) {
            PathNode last = path.isEmpty() ? null : path.get(path.size() - 1);

            if (last == null || !last.nodeId().equals(span.targetTagId())) {
                path.add(new PathNode(span.targetTagId(), span.spanId()));
            }
        }

        long total = canonical.stream()
                .mapToLong(span -> span.startMs() + span.durationMs())
                .max()
                .orElse(0);

        String entryService = canonical.isEmpty() ? "unknown" : canonical.get(0).serviceName();

        return new TraceSnapshot(
                traceId,
                Instant.ofEpochMilli(baseTime).toString(),
                total,
                entryService,
                canonical,
                path);
    }

    /* ----------------------------- 工具 ----------------------------- */

    /** OAP 的 Duration 用 OAP 所在时区的 "yyyy-MM-dd HHmm"，与采集器时区必须一致 */
    private Map<String, String> durationWindow() {
        ZonedDateTime end = ZonedDateTime.now(zoneId);
        ZonedDateTime start = end.minusMinutes(windowMinutes);

        return Map.of(
                "start", DURATION_FORMAT.format(start),
                "end", DURATION_FORMAT.format(end),
                "step", "MINUTE");
    }

    private JsonNode post(String query, Map<String, Object> variables) {
        JsonNode root = JsonHttp.postJson(
                endpoint,
                Map.of("query", query, "variables", variables),
                timeout,
                token);

        JsonNode errors = root.path("errors");

        if (errors.isArray() && !errors.isEmpty()) {
            throw new IllegalStateException(
                    "SkyWalking GraphQL: " + errors.get(0).path("message").asText("unknown error"));
        }

        JsonNode data = root.path("data");

        if (data.isMissingNode() || data.isNull()) {
            throw new IllegalStateException("SkyWalking GraphQL returned no data");
        }

        return data;
    }
}
