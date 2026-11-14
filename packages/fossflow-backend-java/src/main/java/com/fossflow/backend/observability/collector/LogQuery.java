package com.fossflow.backend.observability.collector;

/** 日志查询参数 */
public record LogQuery(
        String tagId,
        String traceId,
        String level,
        int limit) {
}
