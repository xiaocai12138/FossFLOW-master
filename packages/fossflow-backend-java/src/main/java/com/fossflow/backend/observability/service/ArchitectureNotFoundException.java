package com.fossflow.backend.observability.service;

/** 按 ID 读取/更新架构时目标不存在 */
public class ArchitectureNotFoundException extends RuntimeException {

    private final String id;

    public ArchitectureNotFoundException(String id) {
        super("architecture not found: " + id);
        this.id = id;
    }

    public String id() {
        return id;
    }
}
