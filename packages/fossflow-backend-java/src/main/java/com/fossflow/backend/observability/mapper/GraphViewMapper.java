package com.fossflow.backend.observability.mapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.fossflow.backend.observability.entity.ObsEdge;
import com.fossflow.backend.observability.entity.ObsTag;

/**
 * 实体 → 对外视图的映射。
 * 集中在一处，避免 Controller 与 Service 各自拼装响应结构。
 */
@Component
public class GraphViewMapper {

    private final LabelCodec labelCodec;

    public GraphViewMapper(LabelCodec labelCodec) {
        this.labelCodec = labelCodec;
    }

    public Map<String, Object> toNodeView(ObsTag tag) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", tag.getTagId());
        node.put("kind", tag.getKind().name());
        node.put("name", tag.getName());
        node.put("parentId", tag.getParentTagId());
        node.put("labels", labelCodec.decode(tag.getLabels()));
        node.put("health", tag.getHealth().name());
        node.put("lastSeen", tag.getLastSeen() == null ? null : tag.getLastSeen().toString());

        return node;
    }

    public Map<String, Object> toEdgeView(ObsEdge edge) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", "edge:" + edge.getFromTag() + "->" + edge.getToTag()
                + ":" + edge.getKind().name());
        view.put("from", edge.getFromTag());
        view.put("to", edge.getToTag());
        view.put("kind", edge.getKind().name());

        // Map.of 不接受 null 值；边的聚合指标在刚建立时可能为空，
        // 用 LinkedHashMap 才能容纳 null，避免 NPE 直接返回 500。
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("callsPerMin", edge.getCallsPerMin());
        stats.put("errorRate", edge.getErrorRate());
        stats.put("p95Ms", edge.getP95Ms());
        view.put("stats", stats);

        return view;
    }

    public Map<String, Object> toNodeDetail(
            ObsTag tag,
            List<Map<String, Object>> bindings,
            List<String> instanceIds,
            List<String> upstream,
            List<String> downstream) {

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("tagId", tag.getTagId());
        detail.put("kind", tag.getKind().name());
        detail.put("name", tag.getName());
        detail.put("env", tag.getEnv());
        detail.put("parentTagId", tag.getParentTagId());
        detail.put("labels", labelCodec.decode(tag.getLabels()));
        detail.put("health", tag.getHealth().name());
        detail.put("lastSeen", tag.getLastSeen() == null ? null : tag.getLastSeen().toString());
        detail.put("bindings", bindings);
        detail.put("instances", instanceIds);
        detail.put("upstream", upstream);
        detail.put("downstream", downstream);

        return detail;
    }

    public Map<String, Object> toServiceView(
            String tagId,
            ObsTag tag,
            Map<String, Double> values,
            String status) {

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("cpu", values.getOrDefault("cpu", 0.0));
        metrics.put("memory", values.getOrDefault("memory", 0.0));
        metrics.put("latencyP95Ms", values.getOrDefault("latencyP95Ms", 0.0));
        metrics.put("qps", values.getOrDefault("qps", 0.0));
        metrics.put("errorRate", values.getOrDefault("errorRate", 0.0));
        metrics.put("uptimeSeconds", values.getOrDefault("uptimeSeconds", 0.0));

        Map<String, Object> item = new LinkedHashMap<>();
        item.put("tagId", tagId);
        item.put("name", tag == null
                ? tagId.replaceFirst("^svc\\.", "")
                : tag.getName());
        item.put("kind", tag == null ? "SERVICE" : tag.getKind().name());
        item.put("status", status);
        item.put("labels", tag == null ? Map.of() : labelCodec.decode(tag.getLabels()));
        item.put("lastHeartbeat", tag == null || tag.getLastSeen() == null
                ? Instant.now().toString()
                : tag.getLastSeen().toString());
        item.put("metrics", metrics);

        return item;
    }

    public Map<String, Object> toBindingView(String source, String externalId, String tagId) {
        return Map.of("source", source, "externalId", externalId, "tagId", tagId);
    }
}
