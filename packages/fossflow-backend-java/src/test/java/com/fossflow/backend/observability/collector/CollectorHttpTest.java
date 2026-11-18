package com.fossflow.backend.observability.collector;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fossflow.backend.observability.model.NodeKind;
import com.sun.net.httpserver.HttpServer;

/**
 * 用真实形状的 HTTP 响应验证三个采集器的解析链路。
 * 这些测试不打桩在采集器内部，而是起一个本地 HTTP 服务回放报文体，
 * 因此能覆盖 URL 拼装、状态码处理、JSON 解析到 Canonical Model 的全过程。
 */
class CollectorHttpTest {

    private HttpServer server;
    private String baseUrl;

    @BeforeEach
    void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    private void route(String path, String body) {
        server.createContext(path, exchange -> {
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);

            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });
    }

    /* ------------------------- Prometheus ------------------------- */

    @Test
    @DisplayName("Prometheus 按 tag_id 取到真实数值并带上单位")
    void prometheusReadsRealValues() {
        route("/api/v1/query", """
                {"status":"success","data":{"resultType":"vector","result":[
                  {"metric":{"tag_id":"svc.demo"},"value":[1794637607.382,"42.5"]}
                ]}}
                """);

        var collector = new PrometheusCollector(baseUrl, "tag_id", "5m", 3000);
        List<MetricPoint> points = collector.collectMetrics("svc.demo", List.of("cpu"));

        assertThat(points).hasSize(1);
        assertThat(points.get(0).name()).isEqualTo("cpu");
        assertThat(points.get(0).unit()).isEqualTo("%");
        assertThat(points.get(0).value()).isEqualTo(42.5);
    }

    @Test
    @DisplayName("Prometheus 空结果集时不产出指标（不补零）")
    void prometheusSkipsEmptyResults() {
        route("/api/v1/query",
                "{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":[]}}");

        var collector = new PrometheusCollector(baseUrl, "tag_id", "5m", 3000);

        assertThat(collector.collectMetrics("svc.demo", List.of("cpu", "qps"))).isEmpty();
    }

    @Test
    @DisplayName("Prometheus 首个候选无数据时回退到下一个候选")
    void prometheusFallsBackThroughCandidates() {
        List<String> seen = new java.util.concurrent.CopyOnWriteArrayList<>();

        server.createContext("/api/v1/query", exchange -> {
            String raw = exchange.getRequestURI().getQuery();
            String promQl = java.net.URLDecoder.decode(
                    raw.replaceFirst("^query=", ""), StandardCharsets.UTF_8);
            seen.add(promQl);

            // 只有 http_server_requests_seconds_max 命中，模拟真实 Micrometer 的 summary 形态
            // 1000 倍换算由 Prometheus 自己完成，所以服务端返回的已是 ms
            boolean hit = promQl.contains("http_server_requests_seconds_max");
            String body = hit
                    ? "{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":["
                            + "{\"metric\":{},\"value\":[1794637607.382,\"68\"]}]}}"
                    : "{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":[]}}";

            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);

            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });

        var collector = new PrometheusCollector(baseUrl, "tag_id", "5m", 3000);
        List<MetricPoint> points = collector.collectMetrics("svc.demo", List.of("latencyP95Ms"));

        assertThat(points).hasSize(1);
        assertThat(points.get(0).value()).isEqualTo(68.0);
        // 先试 _bucket（真实环境不存在），失败后回退到 _max
        assertThat(seen).anyMatch(query -> query.contains("_seconds_bucket"));
        assertThat(seen).anyMatch(query -> query.contains("_seconds_max"));
    }

    @Test
    @DisplayName("Prometheus cpu 查询使用真实存在的 process_cpu_usage")
    void prometheusCpuUsesRealMicrometerMetric() {
        List<String> seen = new java.util.concurrent.CopyOnWriteArrayList<>();

        server.createContext("/api/v1/query", exchange -> {
            String promQl = java.net.URLDecoder.decode(
                    exchange.getRequestURI().getQuery().replaceFirst("^query=", ""),
                    StandardCharsets.UTF_8);
            seen.add(promQl);

            boolean hit = promQl.contains("process_cpu_usage");
            String body = hit
                    ? "{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":["
                            + "{\"metric\":{},\"value\":[1794637607.382,\"35\"]}]}}"
                    : "{\"status\":\"success\",\"data\":{\"resultType\":\"vector\",\"result\":[]}}";

            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);

            try (OutputStream out = exchange.getResponseBody()) {
                out.write(bytes);
            }
        });

        var collector = new PrometheusCollector(baseUrl, "tag_id", "5m", 3000);
        List<MetricPoint> points = collector.collectMetrics("svc.demo", List.of("cpu"));

        assertThat(points).hasSize(1);
        // Prometheus 端已完成 100×（0.35 → 35），采集器只做四舍五入
        assertThat(points.get(0).value()).isEqualTo(35.0);
        assertThat(seen.get(0)).contains("process_cpu_usage");
        assertThat(seen.get(0)).doesNotContain("process_cpu_seconds_total");
    }

    @Test
    @DisplayName("Prometheus health 读取 buildinfo")
    void prometheusHealth() {
        route("/api/v1/status/buildinfo",
                "{\"status\":\"success\",\"data\":{\"version\":\"2.51.2\"}}");

        var collector = new PrometheusCollector(baseUrl, "tag_id", "5m", 3000);

        assertThat(collector.health().ok()).isTrue();
        assertThat(collector.health().detail()).contains(baseUrl);
    }

    /* ------------------------- Loki ------------------------- */

    @Test
    @DisplayName("Loki health 解析 /ready 响应")
    void lokiHealth() {
        route("/ready", "ready\n");

        var collector = new LokiCollector(baseUrl, 3000, 60, 200);

        assertThat(collector.health().ok()).isTrue();
    }

    @Test
    @DisplayName("Loki 把空 result 转成空列表")
    void lokiEmptyStreams() {
        route("/loki/api/v1/query_range",
                "{\"status\":\"success\",\"data\":{\"resultType\":\"streams\",\"result\":[]}}");

        var collector = new LokiCollector(baseUrl, 3000, 60, 200);

        assertThat(collector.collectLogs(
                new LogQuery("svc.demo", null, null, 10))).isEmpty();
    }

    @Test
    @DisplayName("Loki 解析出带 traceId 的日志条目")
    void lokiParsesStreams() {
        route("/loki/api/v1/query_range", """
                {"status":"success","data":{"resultType":"streams","result":[
                  {"stream":{"application":"demo","level":"ERROR"},
                   "values":[["1794637607382000000","boom traceId=4bf92f3577b34da6a3ce929d0e0e4736"]]}
                ]}}
                """);

        var collector = new LokiCollector(baseUrl, 3000, 60, 200);
        var entries = collector.collectLogs(new LogQuery("svc.demo", null, null, 10));

        assertThat(entries).hasSize(1);
        assertThat(entries.get(0).level()).isEqualTo("ERROR");
        assertThat(entries.get(0).traceId()).isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
        assertThat(entries.get(0).tagId()).isEqualTo("svc.demo");
    }

    /* ------------------------- SkyWalking ------------------------- */

    private SkyWalkingCollector skyWalking() {
        return new SkyWalkingCollector(baseUrl, "", 3000, "Asia/Shanghai", 15, 50);
    }

    @Test
    @DisplayName("SkyWalking health 读 version")
    void skyWalkingHealth() {
        route("/graphql",
                "{\"data\":{\"version\":\"9.4.0-520d531\"}}");

        var collector = skyWalking();

        assertThat(collector.health().ok()).isTrue();
        assertThat(collector.health().detail()).contains("9.4.0");
    }

    @Test
    @DisplayName("SkyWalking 拓扑按 type 映射 NodeKind，User 节点保留为 EXTERNAL")
    void skyWalkingMapsKinds() {
        route("/graphql", """
                {"data":{"getGlobalTopology":{
                  "nodes":[
                    {"id":"a","name":"msc-gateway","type":"Spring Cloud Gateway","isReal":true},
                    {"id":"b","name":"business-service","type":"Tomcat","isReal":true},
                    {"id":"c","name":"order-db","type":"MySQL","isReal":true},
                    {"id":"d","name":"session-cache","type":"Redis","isReal":true},
                    {"id":"e","name":"event-bus","type":"Kafka","isReal":true},
                    {"id":"f","name":"User","type":"User","isReal":false}
                  ],
                  "calls":[
                    {"source":"a","target":"b"},
                    {"source":"b","target":"c"},
                    {"source":"b","target":"d"},
                    {"source":"b","target":"e"},
                    {"source":"f","target":"a"}
                  ]
                }}}
                """);

        GraphSnapshot graph = skyWalking().collectGraph();

        assertThat(graph.nodes()).hasSize(6);
        assertThat(graph.edges()).hasSize(5);

        assertThat(graph.nodes())
                .noneSatisfy(node -> assertThat(node.tagId()).doesNotStartWith("svc."));

        var kindByTag = graph.nodes().stream()
                .collect(java.util.stream.Collectors.toMap(
                        NodeSnapshot::tagId, NodeSnapshot::kind));

        assertThat(kindByTag.get("svc.msc-gateway")).isEqualTo(NodeKind.GATEWAY);
        assertThat(kindByTag.get("svc.business-service")).isEqualTo(NodeKind.SERVICE);
        assertThat(kindByTag.get("svc.order-db")).isEqualTo(NodeKind.DATABASE);
        assertThat(kindByTag.get("svc.session-cache")).isEqualTo(NodeKind.CACHE);
        assertThat(kindByTag.get("svc.event-bus")).isEqualTo(NodeKind.MQ);
        assertThat(kindByTag.get("svc.user")).isEqualTo(NodeKind.EXTERNAL);

        assertThat(graph.edges()).allSatisfy(
                edge -> assertThat(edge.kind().name()).isEqualTo("CALL"));
    }

    @Test
    @DisplayName("SkyWalking 链路以最早 span 为基准排序并生成高亮 path")
    void skyWalkingBuildsTracePath() {
        // 响应键是 GraphQL 里的别名 trace（对齐真实 OAP 报文）
        route("/graphql", """
                {"data":{"trace":{"spans":[
                  {"spanId":"2","parentSpanId":"1","segmentId":"s2","serviceCode":"order-service",
                   "serviceInstanceName":"order-1","startTime":100050,"endTime":100250,
                   "endpointName":"POST /orders","isError":false,"tags":[]},
                  {"spanId":"1","parentSpanId":"-1","segmentId":"s1","serviceCode":"msc-gateway",
                   "serviceInstanceName":"gw-1","startTime":100000,"endTime":100400,
                   "endpointName":"GET /orders","isError":false,"tags":[]},
                  {"spanId":"3","parentSpanId":"2","segmentId":"s3","serviceCode":"order-db",
                   "serviceInstanceName":"db-1","startTime":100100,"endTime":100150,
                   "endpointName":"SELECT","isError":true,"tags":[]}
                ]}}}
                """);

        TraceSnapshot trace = skyWalking().collectTrace("trace-1", List.of());

        assertThat(trace).isNotNull();
        assertThat(trace.traceId()).isEqualTo("trace-1");
        assertThat(trace.spans()).hasSize(3);

        // 按 startMs 升序
        assertThat(trace.spans()).extracting(SpanSnapshot::startMs)
                .containsExactly(0L, 50L, 100L);

        assertThat(trace.spans().get(0).targetTagId()).isEqualTo("svc.msc-gateway");
        assertThat(trace.spans().get(0).serviceName()).isEqualTo("msc-gateway");
        assertThat(trace.spans().get(0).durationMs()).isEqualTo(400L);

        // 最早的 span 没有父 span
        assertThat(trace.spans().get(0).parentSpanId()).isNull();
        assertThat(trace.spans().get(1).parentSpanId()).isEqualTo("1");

        assertThat(trace.spans().get(2).outcome()).isEqualTo("ERROR");

        assertThat(trace.path()).extracting(PathNode::nodeId).containsExactly(
                "svc.msc-gateway", "svc.order-service", "svc.order-db");

        assertThat(trace.entryService()).isEqualTo("msc-gateway");
        assertThat(trace.totalDurationMs()).isEqualTo(400L);
    }

    @Test
    @DisplayName("SkyWalking 查不到链路时返回 null，不编造 span")
    void skyWalkingMissingTrace() {
        route("/graphql", "{\"data\":{\"trace\":null}}");

        assertThat(skyWalking().collectTrace("nope", List.of())).isNull();
    }

    @Test
    @DisplayName("SkyWalking GraphQL errors 会被识别为失败而非空图")
    void skyWalkingSurfacesGraphQlErrors() {
        route("/graphql", """
                {"errors":[{"message":"Validation error: Field 'queryServices' is undefined"}]}
                """);

        var collector = skyWalking();
        HealthCheck check = collector.health();

        assertThat(check.ok()).isFalse();
        assertThat(check.detail()).contains("queryServices");
    }
}
