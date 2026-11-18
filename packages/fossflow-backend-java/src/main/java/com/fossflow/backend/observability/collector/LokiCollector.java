package com.fossflow.backend.observability.collector;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Loki 日志采集器。
 *
 * 只做一件事：把 tagId 翻译成 Loki 的 application 标签，用 LogQL 拉取原始行，
 * 再归一化成 LogEntry。查不到就是空列表，不生成占位数据。
 */
@Component
@ConditionalOnProperty(
        prefix = "fossflow.observability.loki",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class LokiCollector implements Collector {

    private static final Logger log = LoggerFactory.getLogger(LokiCollector.class);

    private final String baseUrl;
    private final Duration timeout;
    private final Duration lookback;
    private final int defaultLimit;

    public LokiCollector(
            @Value("${fossflow.observability.loki.url:http://loki:3100}") String url,
            @Value("${fossflow.observability.loki.timeout-ms:4000}") long timeoutMs,
            @Value("${fossflow.observability.loki.lookback-minutes:60}") long lookbackMinutes,
            @Value("${fossflow.observability.loki.limit:200}") int defaultLimit) {

        this.baseUrl = stripTrailingSlash(url);
        this.timeout = Duration.ofMillis(timeoutMs);
        this.lookback = Duration.ofMinutes(lookbackMinutes);
        this.defaultLimit = defaultLimit;
    }

    @Override
    public String name() {
        return "loki";
    }

    @Override
    public Signal[] emissions() {
        return new Signal[] {Signal.LOG};
    }

    /** 真实打一次 /ready，而不是只看配置里写了地址 */
    @Override
    public HealthCheck health() {
        try {
            String state = JsonHttp.getText(baseUrl + "/ready", timeout).asText().trim();

            return state.toLowerCase().contains("ready")
                    ? HealthCheck.ok("loki ready at " + baseUrl)
                    : HealthCheck.failed("loki not ready: " + state);
        } catch (RuntimeException error) {
            return HealthCheck.failed(error.getMessage());
        }
    }

    @Override
    public List<LogEntry> collectLogs(LogQuery query) {
        if (query == null || query.tagId() == null) {
            return List.of();
        }

        String application = LokiPayload.applicationOf(query.tagId());

        if (application.isEmpty()) {
            // 实例级 tagId 在 Loki 没有对应的流；直接返回空，由调用方给出提示
            return List.of();
        }

        String logQl = LokiPayload.buildLogQl(application, query.traceId());
        int limit = query.limit() <= 0 ? defaultLimit : query.limit();

        String url = baseUrl
                + "/loki/api/v1/query_range"
                + "?query=" + encode(logQl)
                + "&start=" + Instant.now().minus(lookback).getEpochSecond() + "000000000"
                + "&end=" + Instant.now().getEpochSecond() + "000000000"
                + "&limit=" + limit
                + "&direction=backward";

        try {
            JsonNode root = JsonHttp.get(url, timeout);

            if (!root.path("data").path("result").isArray()) {
                log.warn("[loki] unexpected response shape for {}: {}", logQl, root);
            }

            return LokiPayload.parse(query.tagId(), root, query.level(), limit);
        } catch (RuntimeException error) {
            log.warn("[loki] query failed ({}): {}", logQl, error.getMessage());

            return List.of();
        }
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String stripTrailingSlash(String url) {
        String trimmed = url == null ? "" : url.trim();

        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }

        return trimmed;
    }
}
