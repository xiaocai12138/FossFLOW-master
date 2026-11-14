package com.fossflow.backend.observability.dto;

import java.util.List;
import java.util.Map;

/** 图快照视图 */
public record GraphView(
        long version,
        String env,
        long updatedAt,
        List<Map<String, Object>> nodes,
        List<Map<String, Object>> edges) {
}
