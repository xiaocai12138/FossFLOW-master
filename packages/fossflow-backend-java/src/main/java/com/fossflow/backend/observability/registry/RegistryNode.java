package com.fossflow.backend.observability.registry;

import java.util.List;
import java.util.Map;

import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;

/** 服务目录中的一个服务节点，tagId 必须由 TagIds 生成以保证与运行视图对齐 */
public record RegistryNode(
        String tagId,
        NodeKind kind,
        String name,
        Health health,
        Map<String, String> labels,
        List<RegistryInstance> instances) {
}
