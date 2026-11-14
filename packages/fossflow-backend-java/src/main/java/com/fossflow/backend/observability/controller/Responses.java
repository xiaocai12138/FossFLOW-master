package com.fossflow.backend.observability.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** 统一的错误响应构造 */
public final class Responses {

    private Responses() {}

    public static ResponseEntity<Map<String, Object>> error(
            HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .body(Map.of("error", Map.of("code", code, "message", message)));
    }
}
