package com.fossflow.backend.observability.registry;

import java.time.Instant;
import java.util.List;

/**
 * 服务目录的统一返回模型，也是前端唯一认识的契约。
 *
 * edges 允许为空：只提供服务清单的注册中心给不出调用关系，
 * 此时必须在 warnings 里说明，不能让前端把「空边」误读成「无调用」。
 */
public record RegistryCatalog(
        String source,
        Instant fetchedAt,
        List<RegistryNode> nodes,
        List<RegistryEdge> edges,
        List<String> warnings) {

    public static RegistryCatalog empty(String source) {
        return new RegistryCatalog(source, Instant.now(), List.of(), List.of(), List.of());
    }
}
