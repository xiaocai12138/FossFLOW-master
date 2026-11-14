package com.fossflow.backend.observability.controller;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fossflow.backend.observability.collector.LogQuery;
import com.fossflow.backend.observability.service.GraphVersionService;
import com.fossflow.backend.observability.service.TelemetryService;

/** 遥测接口：指标、日志、链路、健康 */
@RestController
@RequestMapping("/api/observability")
public class TelemetryController {

    private final TelemetryService telemetryService;
    private final GraphVersionService versionService;

    public TelemetryController(
            TelemetryService telemetryService,
            GraphVersionService versionService) {
        this.telemetryService = telemetryService;
        this.versionService = versionService;
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("data", telemetryService.health(versionService.current()));
    }

    @GetMapping("/services")
    public Map<String, Object> services(@RequestParam(required = false) String tagIds) {
        List<String> ids = TopologyController.splitCsv(tagIds);

        return Map.of("data", ids.isEmpty()
                ? List.of()
                : telemetryService.getServices(ids));
    }

    @GetMapping("/nodes/{tagId}/metrics")
    public Map<String, Object> metrics(
            @PathVariable String tagId,
            @RequestParam(required = false) String names) {
        List<String> wanted = names == null ? null : TopologyController.splitCsv(names);

        return Map.of("data", Map.of(
                "tagId", tagId,
                "series", telemetryService.getMetrics(tagId, wanted)));
    }

    @GetMapping("/nodes/{tagId}/logs")
    public Map<String, Object> logs(
            @PathVariable String tagId,
            @RequestParam(required = false) String traceId,
            @RequestParam(required = false) String level,
            @RequestParam(defaultValue = "100") int limit) {
        return Map.of("data", telemetryService.getLogs(
                new LogQuery(tagId, traceId, level, limit)));
    }

    /** 必须在 /traces/{traceId} 之前声明，避免被通配路径拦截 */
    @GetMapping("/traces/recent")
    public Map<String, Object> recentTraces(
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String tagIds) {
        return Map.of("data", telemetryService.getRecentTraces(
                limit, TopologyController.splitCsv(tagIds)));
    }

    @GetMapping("/traces/{traceId}")
    public org.springframework.http.ResponseEntity<?> trace(
            @PathVariable String traceId,
            @RequestParam(required = false) String tagIds) {
        var trace = telemetryService.getTrace(
                traceId, TopologyController.splitCsv(tagIds));

        if (trace == null) {
            return Responses.error(
                    org.springframework.http.HttpStatus.NOT_FOUND, "NOT_FOUND", "trace not found");
        }

        return org.springframework.http.ResponseEntity.ok(Map.of("data", trace));
    }
}
