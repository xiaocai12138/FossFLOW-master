package com.fossflow.backend.observability.collector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class LokiPayloadTest {

    @Nested
    @DisplayName("tagId → application 标签")
    class ApplicationOf {

        @Test
        @DisplayName("服务级 tagId 去掉 svc. 前缀")
        void stripsServicePrefix() {
            assertThat(LokiPayload.applicationOf("svc.msc-business-service"))
                    .isEqualTo("msc-business-service");
        }

        @Test
        @DisplayName("点号与中划线在服务名里原样保留")
        void keepsDotsAndDashes() {
            assertThat(LokiPayload.applicationOf("svc.order-db.v2"))
                    .isEqualTo("order-db.v2");
        }

        @Test
        @DisplayName("实例级 tagId 在 Loki 没有对应流，返回空串")
        void instanceTagIdHasNoApplication() {
            assertThat(LokiPayload.applicationOf("inst.msc-business-service.pod-1")).isEmpty();
        }

        @Test
        @DisplayName("非 svc. 前缀与 null 都返回空串")
        void invalidInputs() {
            assertThat(LokiPayload.applicationOf("msc-business-service")).isEmpty();
            assertThat(LokiPayload.applicationOf(null)).isEmpty();
            assertThat(LokiPayload.applicationOf("svc.")).isEmpty();
        }
    }

    @Nested
    @DisplayName("LogQL 拼装")
    class BuildLogQl {

        @Test
        @DisplayName("无 traceId 时只按 application 过滤")
        void withoutTraceId() {
            assertThat(LokiPayload.buildLogQl("msc-business-service", null))
                    .isEqualTo("{application=\"msc-business-service\"}");
        }

        @Test
        @DisplayName("带 traceId 时追加行过滤")
        void withTraceId() {
            assertThat(LokiPayload.buildLogQl("svc-x", "4bf92f3577b34da6a3ce929d0e0e4736"))
                    .isEqualTo("{application=\"svc-x\"} |= \"4bf92f3577b34da6a3ce929d0e0e4736\"");
        }

        @Test
        @DisplayName("引号会被转义，避免破坏 LogQL 语法")
        void escapesQuotes() {
            assertThat(LokiPayload.buildLogQl("a\"b", null))
                    .isEqualTo("{application=\"a\\\"b\"}");
        }
    }

    @Nested
    @DisplayName("Loki 响应解析")
    class Parse {

        private String response(String streamLabels, String line) {
            return """
                    {"status":"success","data":{"resultType":"streams","result":[
                      {"stream":%s,"values":[["1794637607382000000",%s]]}
                    ]}}
                    """.formatted(streamLabels, quote(line));
        }

        private String quote(String value) {
            return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
        }

        private com.fasterxml.jackson.databind.JsonNode json(String raw) {
            try {
                return new com.fasterxml.jackson.databind.ObjectMapper().readTree(raw);
            } catch (Exception error) {
                throw new IllegalStateException(error);
            }
        }

        @Test
        @DisplayName("空结果不伪造日志")
        void emptyResult() {
            var entries = LokiPayload.parse(
                    "svc.x",
                    json("{\"status\":\"success\",\"data\":{\"result\":[]}}"),
                    null,
                    100);

            assertThat(entries).isEmpty();
        }

        @Test
        @DisplayName("traceId 来自 stream 标签")
        void traceIdFromLabel() {
            var root = json(response(
                    "{\"application\":\"msc\",\"trace_id\":\"4bf92f3577b34da6a3ce929d0e0e4736\",\"level\":\"WARN\"}",
                    "business handled request"));

            var entries = LokiPayload.parse("svc.msc", root, null, 100);

            assertThat(entries).hasSize(1);
            assertThat(entries.get(0).traceId())
                    .isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
            assertThat(entries.get(0).level()).isEqualTo("WARN");
            assertThat(entries.get(0).message()).isEqualTo("business handled request");
            assertThat(entries.get(0).tagId()).isEqualTo("svc.msc");
        }

        @Test
        @DisplayName("traceId 来自正文里的 JSON 时也能解析")
        void traceIdFromJsonLine() {
            var root = json(response(
                    "{\"application\":\"msc\"}",
                    "{\"level\":\"ERROR\",\"msg\":\"boom\",\"traceId\":\"abc123def456abc123def456abc12345\"}"));

            var entries = LokiPayload.parse("svc.msc", root, null, 100);

            assertThat(entries).hasSize(1);
            assertThat(entries.get(0).traceId()).isEqualTo("abc123def456abc123def456abc12345");
            assertThat(entries.get(0).level()).isEqualTo("ERROR");
            assertThat(entries.get(0).message()).isEqualTo("boom");
        }

        @Test
        @DisplayName("纯文本正文里的 traceId 与 level 也能解析")
        void traceIdFromPlainLine() {
            var root = json(response(
                    "{\"application\":\"msc\"}",
                    "2026-11-14 14:30:00 WARN [traceId=4bf92f3577b34da6a3ce929d0e0e4736] slow call"));

            var entries = LokiPayload.parse("svc.msc", root, null, 100);

            assertThat(entries).hasSize(1);
            assertThat(entries.get(0).traceId())
                    .isEqualTo("4bf92f3577b34da6a3ce929d0e0e4736");
            assertThat(entries.get(0).level()).isEqualTo("WARN");
        }

        @Test
        @DisplayName("时间戳从纳秒转成 ISO-8601")
        void timestampIsIso() {
            var root = json(response("{\"application\":\"msc\"}", "hello"));

            var entries = LokiPayload.parse("svc.msc", root, null, 100);

            assertThat(entries.get(0).timestamp()).isEqualTo("2026-11-14T06:26:47.382Z");
        }

        @Test
        @DisplayName("level 过滤生效")
        void levelFilter() {
            var root = json(response("{\"application\":\"msc\",\"level\":\"INFO\"}", "hello"));

            assertThat(LokiPayload.parse("svc.msc", root, "ERROR", 100)).isEmpty();
            assertThat(LokiPayload.parse("svc.msc", root, "INFO", 100)).hasSize(1);
            assertThat(LokiPayload.parse("svc.msc", root, "ALL", 100)).hasSize(1);
        }

        @Test
        @DisplayName("limit 会截断结果")
        void respectsLimit() {
            String twoValues = """
                    {"status":"success","data":{"resultType":"streams","result":[
                      {"stream":{"application":"msc"},"values":[
                        ["1794637607000000000","a"],["1794637608000000000","b"]
                      ]}
                    ]}}
                    """;

            assertThat(LokiPayload.parse("svc.msc", json(twoValues), null, 1)).hasSize(1);
        }
    }
}
