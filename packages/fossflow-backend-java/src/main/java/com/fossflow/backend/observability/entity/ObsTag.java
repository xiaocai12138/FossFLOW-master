package com.fossflow.backend.observability.entity;

import java.time.Instant;

import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 图节点元数据。关系库只存元数据，日志与指标留在各自专用存储。
 */
@Entity
@Table(name = "obs_tag")
public class ObsTag {

    @Id
    @Column(name = "tag_id", length = 200, nullable = false)
    private String tagId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 32, nullable = false)
    private NodeKind kind;

    @Column(name = "name", length = 200, nullable = false)
    private String name;

    @Column(name = "env", length = 64, nullable = false)
    private String env;

    @Column(name = "parent_tag_id", length = 200)
    private String parentTagId;

    /** 简化存储：JSON 字符串，避免为少量标签引入额外依赖 */
    @Column(name = "labels", length = 4000)
    private String labels;

    @Enumerated(EnumType.STRING)
    @Column(name = "health", length = 16, nullable = false)
    private Health health;

    @Column(name = "last_seen")
    private Instant lastSeen;

    protected ObsTag() {
        // JPA
    }

    public ObsTag(String tagId, NodeKind kind, String name, String env) {
        this.tagId = tagId;
        this.kind = kind;
        this.name = name;
        this.env = env;
        this.health = Health.UNKNOWN;
    }

    public String getTagId() {
        return tagId;
    }

    public NodeKind getKind() {
        return kind;
    }

    public void setKind(NodeKind kind) {
        this.kind = kind;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEnv() {
        return env;
    }

    public void setEnv(String env) {
        this.env = env;
    }

    public String getParentTagId() {
        return parentTagId;
    }

    public void setParentTagId(String parentTagId) {
        this.parentTagId = parentTagId;
    }

    public String getLabels() {
        return labels;
    }

    public void setLabels(String labels) {
        this.labels = labels;
    }

    public Health getHealth() {
        return health;
    }

    public void setHealth(Health health) {
        this.health = health;
    }

    public Instant getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(Instant lastSeen) {
        this.lastSeen = lastSeen;
    }
}
