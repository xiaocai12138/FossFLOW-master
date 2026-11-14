package com.fossflow.backend.observability.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 模块级键值元数据，例如图版本号（用于 ETag 与增量判断）。
 */
@Entity
@Table(name = "obs_meta")
public class ObsMeta {

    @Id
    @Column(name = "meta_key", length = 100, nullable = false)
    private String key;

    @Column(name = "meta_value", length = 1000)
    private String value;

    protected ObsMeta() {
        // JPA
    }

    public ObsMeta(String key, String value) {
        this.key = key;
        this.value = value;
    }

    public String getKey() {
        return key;
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }
}
