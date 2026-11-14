package com.fossflow.backend.observability.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fossflow.backend.observability.dto.GraphView;
import com.fossflow.backend.observability.entity.ObsEdge;
import com.fossflow.backend.observability.entity.ObsTag;
import com.fossflow.backend.observability.model.EdgeKind;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.service.TopologyService;

/** 拓扑相关接口：图快照、节点、绑定、边 */
@RestController
@RequestMapping("/api/observability")
public class TopologyController {

    private final TopologyService topologyService;

    public TopologyController(TopologyService topologyService) {
        this.topologyService = topologyService;
    }

    @GetMapping("/graph")
    public ResponseEntity<?> graph(
            @RequestParam(required = false) String env,
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {

        GraphView graph = topologyService.getGraph(env);
        String etag = "\"g" + graph.version() + "\"";

        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }

        return ResponseEntity.ok().eTag(etag).body(Map.of("data", graph));
    }

    @GetMapping("/tags")
    public Map<String, Object> tags(@RequestParam(required = false) String env) {
        return Map.of("data", topologyService.listTags(env));
    }

    @PostMapping("/tags")
    public ResponseEntity<?> registerTag(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");

        if (name == null || name.isBlank()) {
            return Responses.error(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT", "name is required");
        }

        NodeKind kind = NodeKind.SERVICE;

        if (body.get("kind") instanceof String raw) {
            try {
                kind = NodeKind.valueOf(raw.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // 保持默认值
            }
        }

        Map<String, String> labels = BodyParsers.toStringMap(body.get("labels"));

        ObsTag tag = topologyService.registerTag(
                name,
                kind,
                (String) body.get("env"),
                labels,
                (String) body.get("parentTagId"));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", tag));
    }

    @PostMapping("/bindings")
    public ResponseEntity<?> bind(@RequestBody Map<String, String> body) {
        String source = body.get("source");
        String externalId = body.get("externalId");
        String tagId = body.get("tagId");

        if (source == null || externalId == null || tagId == null) {
            return Responses.error(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT",
                    "source/externalId/tagId required");
        }

        topologyService.bind(source, externalId, tagId);

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", Map.of(
                "source", source,
                "externalId", externalId,
                "tagId", tagId)));
    }

    @PostMapping("/edges")
    public ResponseEntity<?> createEdge(@RequestBody Map<String, Object> body) {
        String fromTag = (String) body.get("fromTag");
        String toTag = (String) body.get("toTag");

        if (fromTag == null || toTag == null) {
            return Responses.error(HttpStatus.BAD_REQUEST, "INVALID_ARGUMENT",
                    "fromTag/toTag required");
        }

        EdgeKind kind = EdgeKind.CALL;

        if (body.get("kind") instanceof String raw) {
            try {
                kind = EdgeKind.valueOf(raw.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // 保持默认值
            }
        }

        ObsEdge edge = topologyService.upsertEdge(
                fromTag,
                toTag,
                kind,
                (String) body.get("env"),
                BodyParsers.toDouble(body.get("callsPerMin")),
                BodyParsers.toDouble(body.get("errorRate")),
                BodyParsers.toDouble(body.get("p95Ms")));

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("data", edge));
    }

    @GetMapping("/nodes/{tagId}")
    public ResponseEntity<?> node(@PathVariable String tagId) {
        return topologyService.getNode(tagId)
                .<ResponseEntity<?>>map(detail -> ResponseEntity.ok(Map.of("data", detail)))
                .orElseGet(() -> Responses.error(
                        HttpStatus.NOT_FOUND, "NOT_FOUND", "tag not found"));
    }

    @PostMapping("/sync")
    public Map<String, Object> sync() {
        return Map.of("data", topologyService.syncTopology());
    }

    static List<String> splitCsv(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }

        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .toList();
    }
}
