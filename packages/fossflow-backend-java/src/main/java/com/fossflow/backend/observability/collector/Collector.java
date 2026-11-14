package com.fossflow.backend.observability.collector;

import java.util.List;

/**
 * 采集器契约。任何数据源（SkyWalking / Prometheus / 自研）都实现它，
 * 返回 Canonical Model，不允许把上游字段透传到接口层。
 */
public interface Collector {

    /** 唯一标识，写入 provenance.source */
    String name();

    /** 声明的信号能力 */
    Signal[] emissions();

    /** 连通性自检 */
    HealthCheck health();

    /** 拓扑：节点 + 边。不支持时返回空图 */
    default GraphSnapshot collectGraph() {
        return GraphSnapshot.empty();
    }

    /** 实例层节点（Pod 级） */
    default List<NodeSnapshot> collectInstances() {
        return List.of();
    }

    /** 指标 */
    default List<MetricPoint> collectMetrics(String tagId, List<String> names) {
        return List.of();
    }

    /** 日志 */
    default List<LogEntry> collectLogs(LogQuery query) {
        return List.of();
    }

    /** 单条链路 */
    default TraceSnapshot collectTrace(String traceId, List<String> tagIds) {
        return null;
    }

    /** 最近链路 */
    default List<TraceSnapshot> collectRecentTraces(int limit, List<String> tagIds) {
        return List.of();
    }
}
