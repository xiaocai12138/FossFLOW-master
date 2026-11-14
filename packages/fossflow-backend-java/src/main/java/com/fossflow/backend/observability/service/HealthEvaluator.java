package com.fossflow.backend.observability.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fossflow.backend.observability.model.Health;

/** 由指标推导健康状态，阈值集中配置 */
@Component
public class HealthEvaluator {

    private final double errorRateWarn;
    private final double errorRateCritical;
    private final double p95WarnMs;
    private final double p95CriticalMs;

    public HealthEvaluator(
            @Value("${fossflow.observability.threshold.error-rate-warn:5}")
            double errorRateWarn,
            @Value("${fossflow.observability.threshold.error-rate-critical:20}")
            double errorRateCritical,
            @Value("${fossflow.observability.threshold.p95-warn-ms:800}")
            double p95WarnMs,
            @Value("${fossflow.observability.threshold.p95-critical-ms:2000}")
            double p95CriticalMs) {
        this.errorRateWarn = errorRateWarn;
        this.errorRateCritical = errorRateCritical;
        this.p95WarnMs = p95WarnMs;
        this.p95CriticalMs = p95CriticalMs;
    }

    public Health evaluate(double errorRate, double p95Ms, Health fallback) {
        if (errorRate >= errorRateCritical || p95Ms >= p95CriticalMs) {
            return Health.CRITICAL;
        }

        if (errorRate >= errorRateWarn || p95Ms >= p95WarnMs) {
            return Health.WARNING;
        }

        return fallback == Health.OFFLINE ? Health.OFFLINE : Health.HEALTHY;
    }
}
