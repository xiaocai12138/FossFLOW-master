package com.fossflow.backend.observability.collector;

/** 单个 Span */
public record SpanSnapshot(
        String spanId,
        String parentSpanId,
        String targetTagId,
        String serviceName,
        String operation,
        long startMs,
        long durationMs,
        String outcome) {
}
