package com.fossflow.backend.observability.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * 外部标识 → tag_id 绑定。接入任何新采集器的唯一入口。
 */
@Entity
@Table(name = "obs_tag_binding")
@IdClass(ObsTagBindingKey.class)
public class ObsTagBinding {

    @Id
    @Column(name = "source", length = 64, nullable = false)
    private String source;

    @Id
    @Column(name = "external_id", length = 300, nullable = false)
    private String externalId;

    @Column(name = "tag_id", length = 200, nullable = false)
    private String tagId;

    protected ObsTagBinding() {
        // JPA
    }

    public ObsTagBinding(String source, String externalId, String tagId) {
        this.source = source;
        this.externalId = externalId;
        this.tagId = tagId;
    }

    public String getSource() {
        return source;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getTagId() {
        return tagId;
    }

    public void setTagId(String tagId) {
        this.tagId = tagId;
    }
}
