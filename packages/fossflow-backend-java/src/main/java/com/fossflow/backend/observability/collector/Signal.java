package com.fossflow.backend.observability.collector;

/** 采集器能提供的信号类型 */
public enum Signal {
    GRAPH,
    METRIC,
    LOG,
    TRACE
}
