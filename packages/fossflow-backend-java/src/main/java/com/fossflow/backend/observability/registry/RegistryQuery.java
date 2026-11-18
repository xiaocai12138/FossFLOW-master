package com.fossflow.backend.observability.registry;

/**
 * 注册中心查询参数。namespace / group 为 null 时由实现回落到自身配置值，
 * 调用方不需要知道某个实现的默认隔离单元叫什么。
 */
public record RegistryQuery(String namespace, String group, boolean includeInstances) {

    /** 只描述「要什么」，不描述「从哪来」；具体默认值由各实现补齐 */
    public static RegistryQuery of(String namespace, String group, boolean includeInstances) {
        return new RegistryQuery(namespace, group, includeInstances);
    }

    public static RegistryQuery defaults() {
        return new RegistryQuery(null, null, true);
    }
}
