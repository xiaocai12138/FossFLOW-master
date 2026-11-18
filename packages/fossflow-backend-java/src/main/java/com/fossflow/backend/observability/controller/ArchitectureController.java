package com.fossflow.backend.observability.controller;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fossflow.backend.observability.dto.ArchitectureUpsert;
import com.fossflow.backend.observability.service.ArchitectureNotFoundException;
import com.fossflow.backend.observability.service.ArchitectureStorageService;

/**
 * APM 后台架构存储接口。
 *
 * 前端只认这组业务路径，不知道底层用的是 H2 还是 PostgreSQL；
 * 响应统一包 `data`，与既有 observability 接口保持一致。
 */
@RestController
@RequestMapping("/api/observability/architectures")
public class ArchitectureController {

    private final ArchitectureStorageService storageService;

    public ArchitectureController(ArchitectureStorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody(required = false) ArchitectureUpsert request) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of("data", storageService.create(request)));
        } catch (IllegalArgumentException error) {
            return invalid(error);
        }
    }

    @GetMapping
    public Map<String, Object> list() {
        return Map.of("data", storageService.list());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        try {
            return ResponseEntity.ok(Map.of("data", storageService.get(id)));
        } catch (ArchitectureNotFoundException error) {
            return notFound(error);
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable String id,
            @RequestBody(required = false) ArchitectureUpsert request) {
        try {
            return ResponseEntity.ok(Map.of("data", storageService.update(id, request)));
        } catch (IllegalArgumentException error) {
            return invalid(error);
        } catch (ArchitectureNotFoundException error) {
            return notFound(error);
        }
    }

    private static ResponseEntity<Map<String, Object>> invalid(IllegalArgumentException error) {
        return Responses.error(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT", error.getMessage());
    }

    private static ResponseEntity<Map<String, Object>> notFound(ArchitectureNotFoundException error) {
        return Responses.error(HttpStatus.NOT_FOUND, "NOT_FOUND", error.getMessage());
    }
}
