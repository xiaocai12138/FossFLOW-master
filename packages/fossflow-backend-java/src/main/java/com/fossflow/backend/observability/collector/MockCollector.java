package com.fossflow.backend.observability.collector;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fossflow.backend.observability.model.EdgeKind;
import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.model.TagIds;

/**
 * Mock 采集器：在没有 SkyWalking / Prometheus 的环境中产出确定性数据，
 * 让前端先按真实契约对接。
 */
@Component
public class MockCollector implements Collector {

    private static final String[] DEMO_SERVICES = {
        "api-gateway", "order-service", "inventory-service",
        "payment-service", "order-db", "inventory-db"
    };

    private static final NodeKind[] DEMO_KINDS = {
        NodeKind.GATEWAY, NodeKind.SERVICE, NodeKind.SERVICE,
        NodeKind.SERVICE, NodeKind.DATABASE, NodeKind.DATABASE
    };

    private static final String[][] DEMO_EDGES = {
        {"api-gateway", "order-service"},
        {"order-service", "inventory-service"},
        {"order-service", "payment-service"},
        {"order-service", "order-db"},
        {"inventory-service", "inventory-db"}
    };

    private static final String[] DEMO_CHAIN = {
        "api-gateway", "order-service", "inventory-service", "inventory-db"
    };

    private static final String[] LOG_LEVELS = {
        "INFO", "INFO", "INFO", "WARN", "ERROR", "DEBUG"
    };

    private static final Map<String, String[]> LOG_TEMPLATES = Map.of(
            "INFO", new String[] {
                "handled request in {ms}ms",
                "span propagated downstream with parent context",
                "health probe succeeded"
            },
            "WARN", new String[] {
                "retry attempt 1 of 3 after upstream timeout",
                "queue depth approaching threshold: {n}"
            },
            "ERROR", new String[] {
                "downstream call failed with status 503",
                "deadline exceeded after {ms}ms"
            },
            "DEBUG", new String[] {
                "cache lookup miss for key order:{n}",
                "resolved upstream via service discovery"
            });

    private static final Map<String, String> METRIC_UNITS = Map.of(
            "cpu", "%",
            "memory", "%",
            "latencyP95Ms", "ms",
            "qps", "count",
            "errorRate", "%",
            "uptimeSeconds", "s");

    @Override
    public String name() {
        return "mock";
    }

    @Override
    public Signal[] emissions() {
        return new Signal[] {Signal.GRAPH, Signal.METRIC, Signal.LOG, Signal.TRACE};
    }

    @Override
    public HealthCheck health() {
        return HealthCheck.ok("mock collector (no external dependency)");
    }

    /* ----------------------------- 图 ----------------------------- */

    @Override
    public GraphSnapshot collectGraph() {
        List<NodeSnapshot> nodes = new ArrayList<>();

        for (int index = 0; index < DEMO_SERVICES.length; index++) {
            String serviceName = DEMO_SERVICES[index];

            nodes.add(new NodeSnapshot(
                    TagIds.serviceTagId(serviceName),
                    DEMO_KINDS[index],
                    serviceName,
                    null,
                    Map.of("source", "mock"),
                    Health.HEALTHY));
        }

        List<EdgeSnapshot> edges = new ArrayList<>();

        for (String[] edge : DEMO_EDGES) {
            long seed = hash(edge[0] + "->" + edge[1]);

            edges.add(new EdgeSnapshot(
                    TagIds.serviceTagId(edge[0]),
                    TagIds.serviceTagId(edge[1]),
                    EdgeKind.CALL,
                    (double) Math.round(seeded(seed, 40, 900)),
                    round(seeded(seed >>> 3, 0, 2)),
                    round(seeded(seed >>> 5, 20, 400))));
        }

        return new GraphSnapshot(nodes, edges);
    }

    @Override
    public List<NodeSnapshot> collectInstances() {
        List<NodeSnapshot> nodes = new ArrayList<>();

        for (int index = 0; index < DEMO_SERVICES.length; index++) {
            if (DEMO_KINDS[index] != NodeKind.SERVICE) {
                continue;
            }

            String serviceName = DEMO_SERVICES[index];
            long seed = hash(serviceName);

            for (int pod = 0; pod < 2; pod++) {
                String podName = serviceName + "-"
                        + Long.toHexString((seed % 9000) + pod * 17L);

                Map<String, String> labels = new LinkedHashMap<>();
                labels.put("source", "mock");
                labels.put("zone", pod == 0 ? "a" : "b");

                nodes.add(new NodeSnapshot(
                        TagIds.instanceTagId(serviceName, podName),
                        NodeKind.INSTANCE,
                        podName,
                        TagIds.serviceTagId(serviceName),
                        labels,
                        Health.HEALTHY));
            }
        }

        return nodes;
    }

    /* ----------------------------- 指标 ----------------------------- */

    @Override
    public List<MetricPoint> collectMetrics(String tagId, List<String> names) {
        Map<String, Double> values = metricValues(tagId);
        List<String> wanted = (names == null || names.isEmpty())
                ? new ArrayList<>(values.keySet())
                : names;

        List<MetricPoint> points = new ArrayList<>();

        for (String name : wanted) {
            Double value = values.get(name);

            if (value != null) {
                points.add(
                        new MetricPoint(tagId, name, METRIC_UNITS.getOrDefault(name, ""), value));
            }
        }

        return points;
    }

    private static Map<String, Double> metricValues(String tagId) {
        long seed = hash(tagId);
        boolean degraded = Math.abs(seed % 7) == 0;

        Map<String, Double> values = new LinkedHashMap<>();
        values.put("cpu", round(seeded(seed, 8, degraded ? 92 : 68)));
        values.put("memory", round(seeded(seed >>> 2, 25, degraded ? 94 : 78)));
        values.put("latencyP95Ms", round(seeded(seed >>> 4, 18, degraded ? 1200 : 300)));
        values.put("qps", (double) Math.round(seeded(seed >>> 6, 20, 3200)));
        values.put("errorRate", round(degraded
                ? seeded(seed >>> 8, 3, 18)
                : seeded(seed >>> 8, 0, 1.2)));
        values.put("uptimeSeconds",
                (double) Math.round(seeded(seed >>> 10, 3600, 2592000)));

        return values;
    }

    /* ----------------------------- 日志 ----------------------------- */

    @Override
    public List<LogEntry> collectLogs(LogQuery query) {
        String seedKey = query.tagId() + ":"
                + (query.traceId() == null ? "live" : query.traceId());
        long seed = hash(seedKey);
        long base = Instant.now().toEpochMilli() - 600_000L;
        int limit = query.limit() <= 0 ? 40 : Math.min(query.limit(), 500);
        boolean levelGiven = query.level() != null
                && !query.level().isBlank()
                && !"ALL".equalsIgnoreCase(query.level());

        List<LogEntry> entries = new ArrayList<>();

        for (int index = 0; index < limit; index++) {
            long logSeed = hash(query.tagId() + ":" + index + ":" + seed);
            String level = levelGiven
                    ? query.level().toUpperCase()
                    : LOG_LEVELS[(int) (Math.abs(logSeed) % LOG_LEVELS.length)];

            String[] candidates = LOG_TEMPLATES.getOrDefault(level, LOG_TEMPLATES.get("INFO"));
            String template = candidates[(int) (Math.abs(logSeed) % candidates.length)];
            String message = template
                    .replace("{ms}", String.valueOf(Math.round(seeded(logSeed, 4, 480))))
                    .replace("{n}", String.valueOf(Math.abs(logSeed) % 90));

            entries.add(new LogEntry(
                    query.tagId() + "-" + index,
                    query.tagId(),
                    query.traceId(),
                    level,
                    Instant.ofEpochMilli(base + index * 3000L).toString(),
                    query.traceId() == null
                            ? message
                            : "[" + query.tagId() + "] " + message));
        }

        return entries;
    }

    /* ----------------------------- 链路 ----------------------------- */

    @Override
    public TraceSnapshot collectTrace(String traceId, List<String> tagIds) {
        List<String> chainTags = (tagIds != null && tagIds.size() > 1)
                ? new ArrayList<>(tagIds.subList(0, Math.min(tagIds.size(), 6)))
                : Arrays.stream(DEMO_CHAIN).map(TagIds::serviceTagId).toList();

        if (traceId.contains("short")) {
            chainTags = chainTags.subList(0, Math.min(2, chainTags.size()));
        }

        long cursor = 0;
        List<SpanSnapshot> spans = new ArrayList<>();

        for (int index = 0; index < chainTags.size(); index++) {
            String tagId = chainTags.get(index);
            String serviceName = tagId.startsWith("svc.") ? tagId.substring(4) : tagId;
            long spanSeed = hash(traceId + ":" + tagId + ":" + index);
            long duration = Math.round(seeded(spanSeed, 8, index == 0 ? 60 : 240));

            spans.add(new SpanSnapshot(
                    String.valueOf(index + 1),
                    index == 0 ? null : String.valueOf(index),
                    tagId,
                    serviceName,
                    (index == 0 ? "GET" : "POST") + " /api/" + serviceName + "/handle",
                    cursor,
                    duration,
                    Math.abs(spanSeed % 11) == 0 ? "ERROR" : "OK"));

            cursor += Math.round(duration * 0.6) + 2;
        }

        List<PathNode> path = spans.stream()
                .map(span -> new PathNode(span.targetTagId(), span.spanId()))
                .toList();

        long seed = hash(traceId);

        return new TraceSnapshot(
                traceId,
                Instant.ofEpochMilli(
                        Instant.now().toEpochMilli() - (Math.abs(seed) % 600) * 1000L).toString(),
                cursor,
                spans.isEmpty() ? "unknown" : spans.get(0).serviceName(),
                spans,
                path);
    }

    @Override
    public List<TraceSnapshot> collectRecentTraces(int limit, List<String> tagIds) {
        int count = limit <= 0 ? 10 : Math.min(limit, 100);
        List<TraceSnapshot> traces = new ArrayList<>();

        for (int index = 0; index < count; index++) {
            String traceId = String.format("mock-trace-%04d", index + 1);

            traces.add(collectTrace(traceId, tagIds));
        }

        return traces;
    }

    /* ----------------------------- 工具 ----------------------------- */

    private static long hash(String value) {
        long result = 0;

        for (int index = 0; index < value.length(); index++) {
            result = (result * 31 + value.charAt(index)) & 0xFFFFFFFFL;
        }

        return result;
    }

    private static double seeded(long seed, double min, double max) {
        double ratio = (Math.abs(seed) % 1000) / 1000.0;

        return min + ratio * (max - min);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
