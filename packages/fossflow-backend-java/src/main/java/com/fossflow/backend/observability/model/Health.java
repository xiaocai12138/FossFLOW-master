package com.fossflow.backend.observability.model;

/** 节点健康状态 */
public enum Health {
    HEALTHY,
    WARNING,
    CRITICAL,
    OFFLINE,
    UNKNOWN;

    /** 多来源合并时取更严重的状态；null 视为未知，不会覆盖已知值 */
    public static Health worse(Health a, Health b) {
        if (a == null) {
            return b;
        }

        if (b == null) {
            return a;
        }

        return severity(b) > severity(a) ? b : a;
    }

    private static int severity(Health health) {
        if (health == null) {
            return 0;
        }

        return switch (health) {
            case HEALTHY -> 0;
            case UNKNOWN -> 1;
            case WARNING -> 2;
            case CRITICAL -> 3;
            case OFFLINE -> 4;
        };
    }
}
