package com.fossflow.backend.observability.registry;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * 注册目录编排层。它只认识 RegistrySource 抽象：
 * 挑哪个源由配置或显式参数决定，具体怎么拉取与翻译是各实现的事。
 */
@Service
public class RegistryService {

    private final List<RegistrySource> sources;
    private final String defaultSource;

    public RegistryService(
            List<RegistrySource> sources,
            @Value("${fossflow.observability.registry.default-source:}") String defaultSource) {
        this.sources = sources;
        this.defaultSource = defaultSource;
    }

    /** 列出所有源及健康状态，供前端下拉；health 失败不影响其它源 */
    public List<Map<String, Object>> listSources() {
        List<Map<String, Object>> result = new ArrayList<>();

        for (RegistrySource source : sources) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("name", source.name());
            item.put("displayName", source.displayName());

            RegistryHealth health;

            try {
                health = source.health();
            } catch (RuntimeException error) {
                health = RegistryHealth.failed("health probe failed");
            }

            item.put("ok", health.ok());
            item.put("detail", health.detail());
            item.put("isDefault", source.name().equals(resolveSourceName(null)));

            result.add(item);
        }

        return result;
    }

    /** 按配置默认源或显式传入的源拉取；源不存在时抛 RegistryException 交给 Controller 转 400 */
    public RegistryCatalog fetch(String sourceName, RegistryQuery query) {
        String resolved = resolveSourceName(sourceName);

        return find(resolved)
                .orElseThrow(() -> RegistryException.unknownSource(resolved))
                .fetch(query);
    }

    public String resolveSourceName(String sourceName) {
        return sourceName == null || sourceName.isBlank() ? defaultSource : sourceName.trim();
    }

    private java.util.Optional<RegistrySource> find(String sourceName) {
        return sources.stream()
                .filter(source -> source.name().equals(sourceName))
                .findFirst();
    }
}
