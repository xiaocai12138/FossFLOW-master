package com.fossflow.backend.observability.collector;

import java.util.List;

/** 一条完整调用链路 */
public record TraceSnapshot(
        String traceId,
        String startedAt,
        long totalDurationMs,
        String entryService,
        List<SpanSnapshot> spans,
        List<PathNode> path) {
}
