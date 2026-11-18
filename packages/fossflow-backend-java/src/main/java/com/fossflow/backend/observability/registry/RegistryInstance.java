package com.fossflow.backend.observability.registry;

/**
 * 服务下的一个实例。health 用与 Health 枚举同名的大写词（HEALTHY / OFFLINE），
 * 避免再引入第三套健康词汇；weight 可为 null（上游未提供时不编造）。
 */
public record RegistryInstance(String id, String health, Double weight) {
}
