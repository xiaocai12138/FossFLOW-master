package com.fossflow.backend.observability.collector;

/** 调用链路上的一个节点，供前端直接高亮 */
public record PathNode(String nodeId, String spanId) {
}
