package com.fossflow.backend.observability.collector;

import com.fossflow.backend.observability.model.EdgeKind;

/** 采集器上报的边快照 */
public record EdgeSnapshot(
        String fromTag,
        String toTag,
        EdgeKind kind,
        Double callsPerMin,
        Double errorRate,
        Double p95Ms) {
}
