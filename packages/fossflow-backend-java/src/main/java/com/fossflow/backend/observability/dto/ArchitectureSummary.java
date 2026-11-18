package com.fossflow.backend.observability.dto;

import java.time.Instant;

/**
 * 架构摘要。列表接口只返回摘要，不返回整份 diagram，
 * 避免一次拉取把画布体积大的架构全部塞进响应。
 */
public record ArchitectureSummary(String id, String title, Instant updatedAt) {
}
