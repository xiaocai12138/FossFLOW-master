package com.fossflow.backend.observability.collector;

import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Loki 相关的纯函数：tagId → application 标签、LogQL 拼装、响应解析。
 *
 * 独立成类而不是塞进采集器，是为了让转换规则可被单元测试直接覆盖，
 * 不需要起 HTTP 服务。
 */
final class LokiPayload {

    private LokiPayload() {}

    static final String SERVICE_PREFIX = "svc.";

    /**
     * tagId → Loki 的 application 标签。
     * svc.msc-business-service → msc-business-service
     *
     * inst.x.y 这类实例级 tagId 在 Loki 里没有对应流，返回空串由调用方跳过。
     */
    static String applicationOf(String tagId) {
        if (tagId == null) {
            return "";
        }

        String trimmed = tagId.trim();

        if (!trimmed.startsWith(SERVICE_PREFIX)) {
            return "";
        }

        return trimmed.substring(SERVICE_PREFIX.length()).trim();
    }

    /** 按契约拼 LogQL：{application="x"}，带 traceId 时追加行过滤 */
    static String buildLogQl(String application, String traceId) {
        StringBuilder query = new StringBuilder("{application=\"")
                .append(escape(application))
                .append("\"}");

        if (traceId != null && !traceId.isBlank()) {
            query.append(" |= \"").append(escape(traceId.trim())).append('"');
        }

        return query.toString();
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    /**
     * 解析 /loki/api/v1/query_range 的响应。
     * 结构：data.result[].stream{labels} / data.result[].values[[ns, line, meta?]]
     *
     * 查不到时 Loki 返回 result: []，这里返回空列表，绝不伪造数据。
     */
    static List<LogEntry> parse(String tagId, JsonNode root, String levelFilter, int limit) {
        if (root == null) {
            return List.of();
        }

        JsonNode result = root.path("data").path("result");

        if (!result.isArray()) {
            return List.of();
        }

        int cap = limit <= 0 ? 200 : limit;
        List<LogEntry> entries = new java.util.ArrayList<>();

        for (JsonNode stream : result) {
            if (entries.size() >= cap) {
                break;
            }

            JsonNode labels = stream.path("stream");
            String labelTraceId = firstText(labels, "trace_id", "traceid", "traceId");
            String labelLevel = firstText(labels, "level", "detected_level", "severity");

            JsonNode values = stream.path("values");

            if (!values.isArray()) {
                continue;
            }

            for (JsonNode value : values) {
                if (entries.size() >= cap) {
                    break;
                }

                if (!value.isArray() || value.size() < 2) {
                    continue;
                }

                String timestamp = toIsoTimestamp(value.get(0).asText());
                String rawLine = value.get(1).asText("");

                ParsedLine parsed = ParsedLine.of(rawLine);

                String level = parsed.level() != null
                        ? parsed.level()
                        : (labelLevel == null ? "INFO" : labelLevel.toUpperCase());

                if (!acceptLevel(level, levelFilter)) {
                    continue;
                }

                String traceId = parsed.traceId() != null ? parsed.traceId() : labelTraceId;

                entries.add(new LogEntry(
                        tagId + "-" + value.get(0).asText(),
                        tagId,
                        traceId,
                        level,
                        timestamp,
                        parsed.message()));
            }
        }

        return entries;
    }

    private static boolean acceptLevel(String level, String filter) {
        if (filter == null || filter.isBlank() || "ALL".equalsIgnoreCase(filter)) {
            return true;
        }

        return filter.equalsIgnoreCase(level);
    }

    private static String firstText(JsonNode node, String... keys) {
        for (String key : keys) {
            JsonNode value = node.path(key);

            if (value.isTextual() && !value.asText().isBlank()) {
                return value.asText();
            }
        }

        return null;
    }

    /** Loki 时间戳是纳秒级 epoch 字符串 */
    private static String toIsoTimestamp(String raw) {
        try {
            long nanos = Long.parseLong(raw.trim());

            return java.time.Instant
                    .ofEpochSecond(nanos / 1_000_000_000L, nanos % 1_000_000_000L)
                    .toString();
        } catch (NumberFormatException ignored) {
            return raw;
        }
    }

    /**
     * 单行日志的解析结果。
     * Loki 里 traceId / level 既可能出现在 stream 标签，也可能埋在正文里，两边都要兼容。
     */
    record ParsedLine(String message, String level, String traceId) {

        private static final java.util.regex.Pattern TRACE_IN_TEXT = java.util.regex.Pattern.compile(
                "(?i)trace[_\\- ]?id\\s*[=:]\\s*\"?([0-9a-f]{16,32})\"?");

        private static final java.util.regex.Pattern TRACE_HEX = java.util.regex.Pattern.compile(
                "\\b([0-9a-f]{32})\\b");

        private static final java.util.regex.Pattern LEVEL_IN_TEXT = java.util.regex.Pattern.compile(
                "(?i)(?:^|[\\s\\[\"(,])level\\s*[=:]\\s*\"?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\"?");

        private static final java.util.regex.Pattern LEVEL_BARE = java.util.regex.Pattern.compile(
                "\\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\\b");

        static ParsedLine of(String rawLine) {
            String line = rawLine == null ? "" : rawLine;

            JsonNode json = tryParseJson(line);

            if (json != null) {
                String message = firstNonBlank(
                        text(json, "message"), text(json, "msg"),
                        text(json, "@message"), text(json, "log"));

                String level = firstNonBlank(
                        text(json, "level"), text(json, "severity"), text(json, "lvl"));

                String traceId = firstNonBlank(
                        text(json, "traceId"), text(json, "trace_id"),
                        text(json, "traceid"), text(json, "trace"));

                return new ParsedLine(
                        message == null ? line : message,
                        normalizeLevel(level),
                        normalizeTraceId(traceId == null ? line : traceId));
            }

            String level = null;
            var levelMatch = LEVEL_IN_TEXT.matcher(line);

            if (levelMatch.find()) {
                level = normalizeLevel(levelMatch.group(1));
            } else {
                var bare = LEVEL_BARE.matcher(line);

                if (bare.find()) {
                    level = normalizeLevel(bare.group(1));
                }
            }

            return new ParsedLine(line, level, normalizeTraceId(line));
        }

        private static JsonNode tryParseJson(String line) {
            String trimmed = line.trim();

            if (!trimmed.startsWith("{")) {
                return null;
            }

            try {
                JsonNode node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(trimmed);

                return node != null && node.isObject() ? node : null;
            } catch (Exception ignored) {
                return null;
            }
        }

        private static String text(JsonNode node, String key) {
            JsonNode value = node.path(key);

            if (value.isTextual()) {
                return value.asText();
            }

            if (value.isNumber() || value.isBoolean()) {
                return value.asText();
            }

            return null;
        }

        private static String firstNonBlank(String... values) {
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }

            return null;
        }

        private static String normalizeLevel(String level) {
            if (level == null) {
                return null;
            }

            String upper = level.trim().toUpperCase();

            if (upper.startsWith("WARN")) {
                return "WARN";
            }

            return switch (upper) {
                case "TRACE", "DEBUG", "INFO", "ERROR", "FATAL" -> upper;
                default -> null;
            };
        }

        private static String normalizeTraceId(String candidate) {
            if (candidate == null || candidate.isBlank()) {
                return null;
            }

            var labeled = TRACE_IN_TEXT.matcher(candidate);

            if (labeled.find()) {
                return labeled.group(1);
            }

            var hex = TRACE_HEX.matcher(candidate);

            if (hex.find()) {
                return hex.group(1);
            }

            return null;
        }
    }
}
