package com.fossflow.backend.observability.collector;

/** 单个指标点 */
public record MetricPoint(String tagId, String name, String unit, Double value) {
}
