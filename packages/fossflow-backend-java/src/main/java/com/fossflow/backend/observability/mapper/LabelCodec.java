package com.fossflow.backend.observability.mapper;

import java.util.Map;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

/** labels 字段的 JSON 编解码，失败时静默降级为空 Map */
@Component
public class LabelCodec {

    private final ObjectMapper objectMapper;

    public LabelCodec(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String encode(Map<String, String> labels) {
        if (labels == null || labels.isEmpty()) {
            return "{}";
        }

        try {
            return objectMapper.writeValueAsString(labels);
        } catch (Exception error) {
            return "{}";
        }
    }

    public Map<String, String> decode(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, String>>() {});
        } catch (Exception error) {
            return Map.of();
        }
    }
}
