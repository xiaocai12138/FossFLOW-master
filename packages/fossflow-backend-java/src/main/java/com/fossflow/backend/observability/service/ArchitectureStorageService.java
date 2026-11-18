package com.fossflow.backend.observability.service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fossflow.backend.observability.dto.ArchitectureSummary;
import com.fossflow.backend.observability.dto.ArchitectureUpsert;
import com.fossflow.backend.observability.dto.ArchitectureView;
import com.fossflow.backend.observability.entity.ArchitectureDocument;
import com.fossflow.backend.observability.repository.ArchitectureDocumentRepository;

/**
 * 后台架构的保存、列表、读取与更新。
 *
 * 边界：本服务只负责 DiagramData 的身份、版本与持久化，
 * 不解析画布内部结构，也不触碰注册中心/链路/日志等基础设施。
 */
@Service
public class ArchitectureStorageService {

    static final int MAX_TITLE_LENGTH = 200;
    static final int MAX_DIAGRAM_LENGTH = 4_000_000;

    private final ArchitectureDocumentRepository repository;
    private final ObjectMapper objectMapper;

    public ArchitectureStorageService(
            ArchitectureDocumentRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ArchitectureView create(ArchitectureUpsert request) {
        String title = requireTitle(request == null ? null : request.title());
        JsonNode diagram = requireDiagram(request == null ? null : request.diagram());
        Instant now = Instant.now();

        ArchitectureDocument document = new ArchitectureDocument(
                UUID.randomUUID().toString(), title, serialize(diagram), now);

        return toView(repository.save(document));
    }

    @Transactional(readOnly = true)
    public List<ArchitectureSummary> list() {
        return repository.findAllByOrderByUpdatedAtDesc().stream()
                .map(document -> new ArchitectureSummary(
                        document.getId(), document.getTitle(), document.getUpdatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ArchitectureView get(String id) {
        return toView(load(id));
    }

    @Transactional
    public ArchitectureView update(String id, ArchitectureUpsert request) {
        String title = requireTitle(request == null ? null : request.title());
        JsonNode diagram = requireDiagram(request == null ? null : request.diagram());

        ArchitectureDocument document = load(id);
        document.update(title, serialize(diagram), Instant.now());

        return toView(repository.save(document));
    }

    private ArchitectureDocument load(String id) {
        if (id == null || id.isBlank()) {
            throw new ArchitectureNotFoundException(String.valueOf(id));
        }

        return repository.findById(id)
                .orElseThrow(() -> new ArchitectureNotFoundException(id));
    }

    private static String requireTitle(String raw) {
        String title = raw == null ? "" : raw.trim();

        if (title.isEmpty()) {
            throw new IllegalArgumentException("title is required");
        }

        if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException(
                    "title must be at most " + MAX_TITLE_LENGTH + " characters");
        }

        return title;
    }

    private static JsonNode requireDiagram(JsonNode diagram) {
        if (diagram == null || diagram.isNull()) {
            throw new IllegalArgumentException("diagram is required");
        }

        if (!diagram.isObject()) {
            throw new IllegalArgumentException("diagram must be a JSON object");
        }

        return diagram;
    }

    private String serialize(JsonNode diagram) {
        String json;

        try {
            json = objectMapper.writeValueAsString(diagram);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("diagram is not serializable", error);
        }

        if (json.length() > MAX_DIAGRAM_LENGTH) {
            throw new IllegalArgumentException(
                    "diagram exceeds " + MAX_DIAGRAM_LENGTH + " characters");
        }

        return json;
    }

    private ArchitectureView toView(ArchitectureDocument document) {
        return new ArchitectureView(
                document.getId(),
                document.getTitle(),
                read(document.getDiagramJson()),
                document.getCreatedAt(),
                document.getUpdatedAt());
    }

    private JsonNode read(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (JsonProcessingException error) {
            // 入库内容由本服务自己写入，读到坏数据说明存储被外部改坏
            throw new IllegalStateException("stored diagram is not valid JSON", error);
        }
    }
}
