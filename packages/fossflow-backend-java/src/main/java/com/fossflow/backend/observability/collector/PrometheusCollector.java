package com.fossflow.backend.observability.collector;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Prometheus 采集器，只产出 METRIC。
 *
 * 所有查询都按 label（默认 tag_id）锚定节点，保证指标能和图节点对齐。
 * 每个逻辑指标准备多个候选 PromQL：不同技术栈（Spring Boot / 容器 / Node exporter）
 * 的指标名不同，按顺序取第一个有数据的。取不到就跳过，不补零、不造值。
 */
@Component
@ConditionalOnProperty(
        prefix = "fossflow.observability.prometheus",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class PrometheusCollector implements Collector {

    private static final Logger log = LoggerFactory.getLogger(PrometheusCollector.class);

    private static final Map<String, String> UNITS = Map.of(
            "cpu", "%",
            "memory", "MB",
            "qps", "req/s",
            "errorRate", "%",
            "latencyP95Ms", "ms",
            "uptimeSeconds", "s");

    /**
     * 逻辑指标 → 候选 PromQL 列表（按优先级）。
     * 占位符：${label} ${tag} ${rate} ${name}
     *
     * 注意命中实测结果（Spring Boot + micrometer-registry-prometheus）：
     *  - 没有 process_cpu_seconds_total，只有 process_cpu_usage（0~1 小数），故需 ×100
     *  - http_server_requests_seconds 是 summary，只暴露 _count/_sum/_max，没有 _bucket，
     *    因此 histogram_quantile 永远算不出值，P95 只能退化为 _max（真实可得的耗时上界）
     */
    private static final Map<String, List<String>> CANDIDATES = Map.of(
            "cpu", List.of(
                    "100 * sum(process_cpu_usage{${label}=\"${tag}\"})",
                    "100 * sum(rate(process_cpu_seconds_total{${label}=\"${tag}\"}[${rate}]))",
                    "100 * sum(rate(container_cpu_usage_seconds_total{${label}=\"${tag}\"}[${rate}]))",
                    "100 * sum(system_cpu_usage{${label}=\"${tag}\"})"),

            "memory", List.of(
                    "sum(jvm_memory_used_bytes{${label}=\"${tag}\",area=\"heap\"}) / 1024 / 1024",
                    "sum(jvm_memory_used_bytes{${label}=\"${tag}\"}) / 1024 / 1024",
                    "sum(container_memory_working_set_bytes{${label}=\"${tag}\"}) / 1024 / 1024",
                    "sum(process_resident_memory_bytes{${label}=\"${tag}\"}) / 1024 / 1024"),

            "qps", List.of(
                    "sum(rate(http_server_requests_seconds_count{${label}=\"${tag}\"}[${rate}]))",
                    "sum(rate(http_requests_total{${label}=\"${tag}\"}[${rate}]))",
                    "sum(rate(request_count_total{${label}=\"${tag}\"}[${rate}]))"),

            "errorRate", List.of(
                    "100 * sum(rate(http_server_requests_seconds_count"
                            + "{${label}=\"${tag}\",status=~\"5..\"}[${rate}]))"
                            + " / clamp_min(sum(rate(http_server_requests_seconds_count"
                            + "{${label}=\"${tag}\"}[${rate}])), 0.0001)",
                    "100 * sum(rate(http_requests_total"
                            + "{${label}=\"${tag}\",status=~\"5..\"}[${rate}]))"
                            + " / clamp_min(sum(rate(http_requests_total"
                            + "{${label}=\"${tag}\"}[${rate}])), 0.0001)"),

            "latencyP95Ms", List.of(
                    "1000 * histogram_quantile(0.95, sum(rate("
                            + "http_server_requests_seconds_bucket{${label}=\"${tag}\"}[${rate}])) by (le))",
                    "1000 * histogram_quantile(0.95, sum(rate("
                            + "http_request_duration_seconds_bucket{${label}=\"${tag}\"}[${rate}])) by (le))",
                    "1000 * max(http_server_requests_seconds_max{${label}=\"${tag}\"})",
                    "1000 * max(http_request_duration_seconds_max{${label}=\"${tag}\"})"),

            "uptimeSeconds", List.of(
                    "time() - process_start_time_seconds{${label}=\"${tag}\"}",
                    "process_uptime_seconds{${label}=\"${tag}\"}",
                    "time() - node_boot_time_seconds{${label}=\"${tag}\"}"));

    /** 未知指标名也尝试按名字前缀匹配，能取到就给真实值 */
    private static final String NAME_PROBE =
            "sum({${label}=\"${tag}\", __name__=~\"${name}.*\"})";

    private final String baseUrl;
    private final String label;
    private final String rateWindow;
    private final Duration timeout;

    public PrometheusCollector(
            @Value("${fossflow.observability.prometheus.url:http://prometheus:9090}") String url,
            @Value("${fossflow.observability.prometheus.label:tag_id}") String label,
            @Value("${fossflow.observability.prometheus.rate-window:5m}") String rateWindow,
            @Value("${fossflow.observability.prometheus.timeout-ms:4000}") long timeoutMs) {

        String base = url == null ? "" : url.trim();

        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }

        this.baseUrl = base;
        this.label = label;
        this.rateWindow = rateWindow;
        this.timeout = Duration.ofMillis(timeoutMs);
    }

    @Override
    public String name() {
        return "prometheus";
    }

    @Override
    public Signal[] emissions() {
        return new Signal[] {Signal.METRIC};
    }

    @Override
    public HealthCheck health() {
        try {
            JsonNode root = JsonHttp.get(baseUrl + "/api/v1/status/buildinfo", timeout);

            return "success".equalsIgnoreCase(root.path("status").asText(""))
                    ? HealthCheck.ok("prometheus ready at " + baseUrl)
                    : HealthCheck.failed("prometheus unhealthy: " + root.path("status").asText());
        } catch (RuntimeException error) {
            return HealthCheck.failed(error.getMessage());
        }
    }

    @Override
    public List<MetricPoint> collectMetrics(String tagId, List<String> names) {
        if (tagId == null || tagId.isBlank()) {
            return List.of();
        }

        List<String> wanted = (names == null || names.isEmpty())
                ? new ArrayList<>(CANDIDATES.keySet())
                : names;

        List<MetricPoint> points = new ArrayList<>();

        for (String name : wanted) {
            Double value = resolve(name, tagId);

            if (value == null || value.isNaN() || value.isInfinite()) {
                continue;
            }

            points.add(new MetricPoint(
                    tagId, name, UNITS.getOrDefault(name, ""), round(value)));
        }

        return points;
    }

    /** 依次尝试候选 PromQL，返回第一个拿到的真实值 */
    private Double resolve(String name, String tagId) {
        List<String> queries = CANDIDATES.get(name);

        if (queries == null) {
            return tryQuery(buildQuery(NAME_PROBE, name, tagId));
        }

        for (String template : queries) {
            Double value = tryQuery(buildQuery(template, name, tagId));

            if (value != null) {
                return value;
            }
        }

        return null;
    }

    private Double tryQuery(String promQl) {
        try {
            return instantQuery(promQl);
        } catch (RuntimeException error) {
            log.debug("[prometheus] query failed ({}): {}", promQl, error.getMessage());

            return null;
        }
    }

    private String buildQuery(String template, String name, String tagId) {
        return template
                .replace("${label}", label)
                .replace("${tag}", tagId)
                .replace("${rate}", rateWindow)
                .replace("${name}", name);
    }

    private Double instantQuery(String promQl) {
        String url = baseUrl
                + "/api/v1/query?query=" + URLEncoder.encode(promQl, StandardCharsets.UTF_8);

        JsonNode root = JsonHttp.get(url, timeout);

        if (!"success".equalsIgnoreCase(root.path("status").asText(""))) {
            throw new IllegalStateException(
                    "prometheus error: " + root.path("error").asText("unknown"));
        }

        JsonNode result = root.path("data").path("result");

        if (!result.isArray() || result.isEmpty()) {
            return null;
        }

        JsonNode first = result.get(0);
        JsonNode value = first.path("value");

        if (value.isArray() && value.size() >= 2) {
            return parse(value.get(1).asText());
        }

        JsonNode values = first.path("values");

        if (values.isArray() && !values.isEmpty()) {
            JsonNode last = values.get(values.size() - 1);

            if (last.isArray() && last.size() >= 2) {
                return parse(last.get(1).asText());
            }
        }

        return null;
    }

    private static Double parse(String raw) {
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
