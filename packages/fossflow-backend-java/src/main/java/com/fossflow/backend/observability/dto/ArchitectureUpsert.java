package com.fossflow.backend.observability.dto;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * 创建/更新后台架构的请求体。
 *
 * `diagram` 必须是 JSON 对象（与画布 DiagramData 对齐），
 * 后端只校验它是对象，不校验内部图形字段。
 */
public record ArchitectureUpsert(String title, JsonNode diagram) {
}
