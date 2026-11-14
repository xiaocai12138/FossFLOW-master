package com.fossflow.backend.observability.collector;

/** 单条日志 */
public record LogEntry(
        String id,
        String tagId,
        String traceId,
        String level,
        String timestamp,
        String message) {
}
