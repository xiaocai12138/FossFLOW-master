package com.fossflow.backend.observability.entity;

import java.time.Instant;

import com.fossflow.backend.observability.model.EdgeKind;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * 图边。聚合值（调用量/错误率/P95）属于拓扑属性，不是时序，因此放在关系库。
 */
@Entity
@Table(name = "obs_edge")
@IdClass(ObsEdgeKey.class)
public class ObsEdge {

    @Id
    @Column(name = "from_tag", length = 200, nullable = false)
    private String fromTag;

    @Id
    @Column(name = "to_tag", length = 200, nullable = false)
    private String toTag;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 16, nullable = false)
    private EdgeKind kind;

    @Id
    @Column(name = "env", length = 64, nullable = false)
    private String env;

    @Column(name = "calls_per_min")
    private Double callsPerMin;

    @Column(name = "error_rate")
    private Double errorRate;

    @Column(name = "p95_ms")
    private Double p95Ms;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ObsEdge() {
        // JPA
    }

    public ObsEdge(String fromTag, String toTag, String env) {
        this.fromTag = fromTag;
        this.toTag = toTag;
        this.env = env;
        this.kind = EdgeKind.CALL;
        this.updatedAt = Instant.now();
    }

    public String getFromTag() {
        return fromTag;
    }

    public String getToTag() {
        return toTag;
    }

    public EdgeKind getKind() {
        return kind;
    }

    public void setKind(EdgeKind kind) {
        this.kind = kind;
    }

    public String getEnv() {
        return env;
    }

    public Double getCallsPerMin() {
        return callsPerMin;
    }

    public void setCallsPerMin(Double callsPerMin) {
        this.callsPerMin = callsPerMin;
    }

    public Double getErrorRate() {
        return errorRate;
    }

    public void setErrorRate(Double errorRate) {
        this.errorRate = errorRate;
    }

    public Double getP95Ms() {
        return p95Ms;
    }

    public void setP95Ms(Double p95Ms) {
        this.p95Ms = p95Ms;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
