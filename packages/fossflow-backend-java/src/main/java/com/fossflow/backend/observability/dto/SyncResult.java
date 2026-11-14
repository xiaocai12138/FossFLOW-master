package com.fossflow.backend.observability.dto;

import java.util.List;
import java.util.Map;

/** 拓扑同步结果 */
public record SyncResult(
        int nodes,
        int edges,
        List<Map<String, Object>> collectors) {
}
