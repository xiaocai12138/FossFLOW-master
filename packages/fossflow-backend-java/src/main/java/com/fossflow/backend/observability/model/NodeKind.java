package com.fossflow.backend.observability.model;

/** 图节点的类别 */
public enum NodeKind {
    SERVICE,
    INSTANCE,
    DATABASE,
    CACHE,
    MQ,
    GATEWAY,
    EXTERNAL
}
