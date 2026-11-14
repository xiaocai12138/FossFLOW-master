package com.fossflow.backend.observability.collector;

import java.util.Map;

import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;

/** 采集器上报的节点快照，env 由服务层统一填充 */
public record NodeSnapshot(
        String tagId,
        NodeKind kind,
        String name,
        String parentTagId,
        Map<String, String> labels,
        Health health) {
}
