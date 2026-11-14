package com.fossflow.backend.observability.collector;

/** 采集器连通性自检结果 */
public record HealthCheck(boolean ok, String detail) {

    public static HealthCheck ok(String detail) {
        return new HealthCheck(true, detail);
    }

    public static HealthCheck failed(String detail) {
        return new HealthCheck(false, detail);
    }
}
