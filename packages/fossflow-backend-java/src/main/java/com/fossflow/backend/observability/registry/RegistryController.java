package com.fossflow.backend.observability.registry;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fossflow.backend.observability.controller.Responses;

/**
 * 服务注册目录接口。注意本类不得出现任何具体注册中心的产品名：
 * 前端拿到的 source 是从 /sources 动态读来的，换实现无需改这里。
 */
@RestController
@RequestMapping("/api/observability/registry")
public class RegistryController {

    private final RegistryService registryService;

    public RegistryController(RegistryService registryService) {
        this.registryService = registryService;
    }

    /** 前端下拉：可用来源 + 连通性 */
    @GetMapping("/sources")
    public Map<String, Object> sources() {
        return Map.of("data", registryService.listSources());
    }

    /** 核心接口：按来源拉取服务目录 */
    @GetMapping("/services")
    public ResponseEntity<?> services(
            @RequestParam(required = false) String source,
            @RequestParam(required = false) Boolean includeInstances,
            @RequestParam(required = false) String namespace,
            @RequestParam(required = false) String group) {

        boolean withInstances = includeInstances == null || includeInstances;

        try {
            RegistryCatalog catalog = registryService.fetch(
                    source,
                    new RegistryQuery(namespace, group, withInstances));

            return ResponseEntity.ok(Map.of("data", catalog));
        } catch (RegistryException error) {
            HttpStatus status = "UNKNOWN_SOURCE".equals(error.code())
                    ? HttpStatus.BAD_REQUEST
                    : HttpStatus.BAD_GATEWAY;

            return Responses.error(status, error.code(), error.getMessage());
        }
    }
}
