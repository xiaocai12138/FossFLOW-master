package com.fossflow.backend.observability.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fossflow.backend.observability.entity.ObsMeta;
import com.fossflow.backend.observability.repository.ObsMetaRepository;

/** 图版本号维护，用于 ETag 与增量判断 */
@Component
public class GraphVersionService {

    private static final String GRAPH_VERSION_KEY = "graph.version";

    private final ObsMetaRepository metaRepository;

    @Value("${fossflow.observability.env:prod}")
    private String defaultEnv;

    public GraphVersionService(ObsMetaRepository metaRepository) {
        this.metaRepository = metaRepository;
    }

    public String defaultEnv() {
        return defaultEnv;
    }

    public long current() {
        return metaRepository.findById(GRAPH_VERSION_KEY)
                .map(meta -> {
                    try {
                        return Long.parseLong(meta.getValue());
                    } catch (NumberFormatException ignored) {
                        return 0L;
                    }
                })
                .orElse(0L);
    }

    public void bump() {
        long next = current() + 1;
        ObsMeta meta = metaRepository.findById(GRAPH_VERSION_KEY)
                .orElseGet(() -> new ObsMeta(GRAPH_VERSION_KEY, "0"));

        meta.setValue(String.valueOf(next));
        metaRepository.save(meta);
    }
}
