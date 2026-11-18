package com.fossflow.backend.observability.registry.nacos;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Nacos 承接层的配置。这些字段的语义只在本包内成立，
 * 上层与前端不应读取任何一项。
 */
@Component
@ConfigurationProperties(prefix = "fossflow.observability.registry.nacos")
public class NacosProperties {

    private boolean enabled = true;
    private String url = "http://nacos:8848";
    private String namespace = "public";
    private String group = "DEFAULT_GROUP";
    private long timeoutMs = 5000;
    private int instanceConcurrency = 5;
    private int pageSize = 500;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getNamespace() {
        return namespace;
    }

    public void setNamespace(String namespace) {
        this.namespace = namespace;
    }

    public String getGroup() {
        return group;
    }

    public void setGroup(String group) {
        this.group = group;
    }

    public long getTimeoutMs() {
        return timeoutMs;
    }

    public void setTimeoutMs(long timeoutMs) {
        this.timeoutMs = timeoutMs;
    }

    public int getInstanceConcurrency() {
        return instanceConcurrency;
    }

    public void setInstanceConcurrency(int instanceConcurrency) {
        this.instanceConcurrency = instanceConcurrency;
    }

    public int getPageSize() {
        return pageSize;
    }

    public void setPageSize(int pageSize) {
        this.pageSize = pageSize;
    }
}
