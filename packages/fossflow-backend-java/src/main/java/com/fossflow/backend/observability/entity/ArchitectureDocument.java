package com.fossflow.backend.observability.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 后台保存的架构文档。
 *
 * 只把整份 DiagramData 当作不透明业务载荷存下来，不解析画布内部的
 * item / view / connector 结构 —— 解析会让后端与画布 schema 产生耦合，
 * 前端每次调整图形结构都要改后端。
 */
@Entity
@Table(name = "obs_architecture")
public class ArchitectureDocument {

    @Id
    @Column(name = "id", length = 36, nullable = false)
    private String id;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    /**
     * 完整 DiagramData 的 JSON 文本。
     * 用显式长度而不是 @Lob，避免 H2 与 PostgreSQL 对 CLOB 映射不一致。
     */
    @Column(name = "diagram_json", length = 4_000_000, nullable = false)
    private String diagramJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ArchitectureDocument() {
        // JPA
    }

    public ArchitectureDocument(String id, String title, String diagramJson, Instant now) {
        this.id = id;
        this.title = title;
        this.diagramJson = diagramJson;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public String getId() {
        return id;
    }

    public String getTitle() {
        return title;
    }

    public String getDiagramJson() {
        return diagramJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /** 更新标题与载荷，并推进 updatedAt */
    public void update(String title, String diagramJson, Instant now) {
        this.title = title;
        this.diagramJson = diagramJson;
        this.updatedAt = now;
    }
}
