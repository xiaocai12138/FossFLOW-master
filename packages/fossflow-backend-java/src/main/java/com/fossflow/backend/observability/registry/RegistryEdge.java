package com.fossflow.backend.observability.registry;

/** from/to 均为 tagId，kind 使用 EdgeKind 的名称字符串，与图模型保持同一套词汇 */
public record RegistryEdge(String from, String to, String kind) {
}
