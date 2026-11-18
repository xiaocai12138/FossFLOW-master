package com.fossflow.backend.observability.dto;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

/** 完整架构视图：按 ID 读取或保存成功后返回，包含整份 diagram */
public record ArchitectureView(
        String id,
        String title,
        JsonNode diagram,
        Instant createdAt,
        Instant updatedAt) {
}
