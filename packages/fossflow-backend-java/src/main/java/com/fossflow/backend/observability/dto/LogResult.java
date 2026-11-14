package com.fossflow.backend.observability.dto;

import java.util.List;

import com.fossflow.backend.observability.collector.LogEntry;

/** 日志查询结果，含降级告警 */
public record LogResult(
        String tagId,
        List<LogEntry> items,
        List<String> warnings) {
}
