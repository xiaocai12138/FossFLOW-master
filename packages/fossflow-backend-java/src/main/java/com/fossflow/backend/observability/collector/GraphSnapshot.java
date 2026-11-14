package com.fossflow.backend.observability.collector;

import java.util.List;

/** 采集器返回的图片段，env 由服务层统一填充 */
public record GraphSnapshot(List<NodeSnapshot> nodes, List<EdgeSnapshot> edges) {

    public static GraphSnapshot empty() {
        return new GraphSnapshot(List.of(), List.of());
    }
}
