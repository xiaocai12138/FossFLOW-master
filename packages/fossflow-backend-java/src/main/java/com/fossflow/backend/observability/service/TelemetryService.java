package com.fossflow.backend.observability.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fossflow.backend.observability.collector.Collector;
import com.fossflow.backend.observability.collector.HealthCheck;
import com.fossflow.backend.observability.collector.LogEntry;
import com.fossflow.backend.observability.collector.LogQuery;
import com.fossflow.backend.observability.collector.MetricPoint;
import com.fossflow.backend.observability.collector.TraceSnapshot;
import com.fossflow.backend.observability.collector.Signal;
import com.fossflow.backend.observability.dto.LogResult;
import com.fossflow.backend.observability.entity.ObsTag;
import com.fossflow.backend.observability.mapper.GraphViewMapper;
import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.repository.ObsTagRepository;

/** 閬ユ祴鏁版嵁锛堟寚鏍?/ 鏃ュ織 / 閾捐矾锛夌殑鏌ヨ缂栨帓 */
@Service
public class TelemetryService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryService.class);

    private final CollectorRegistry registry;
    private final ObsTagRepository tagRepository;
    private final HealthEvaluator healthEvaluator;
    private final GraphViewMapper viewMapper;

    public TelemetryService(
            CollectorRegistry registry,
            ObsTagRepository tagRepository,
            HealthEvaluator healthEvaluator,
            GraphViewMapper viewMapper) {
        this.registry = registry;
        this.tagRepository = tagRepository;
        this.healthEvaluator = healthEvaluator;
        this.viewMapper = viewMapper;
    }

    public List<MetricPoint> getMetrics(String tagId, List<String> names) {
        List<MetricPoint> points = new ArrayList<>();

        for (Collector collector : registry.byCapability(Signal.METRIC)) {
            try {
                points.addAll(collector.collectMetrics(tagId, names));
            } catch (RuntimeException error) {
                log.warn("[observability] metrics failed for {}: {}",
                        collector.name(), error.getMessage());
            }
        }

        return points;
    }

    /** 鎵归噺鏈嶅姟鐘舵€侊細鍏冩暟鎹潵鑷叧绯诲簱锛屾寚鏍囨潵鑷?METRIC 閲囬泦鍣?*/
    public List<Map<String, Object>> getServices(List<String> tagIds) {
        List<Map<String, Object>> items = new ArrayList<>();

        for (String tagId : tagIds) {
            ObsTag tag = tagRepository.findById(tagId).orElse(null);

            Map<String, Double> values = getMetrics(tagId, null).stream()
                    .collect(Collectors.toMap(
                            MetricPoint::name,
                            MetricPoint::value,
                            (left, right) -> right));

            Health status = healthEvaluator.evaluate(
                    values.getOrDefault("errorRate", 0.0),
                    values.getOrDefault("latencyP95Ms", 0.0),
                    tag == null ? Health.UNKNOWN : tag.getHealth());

            items.add(viewMapper.toServiceView(tagId, tag, values, status.name()));
        }

        return items;
    }

    public LogResult getLogs(LogQuery query) {
        List<String> warnings = new ArrayList<>();

        for (Collector collector : registry.byCapability(Signal.LOG)) {
            try {
                List<LogEntry> entries = collector.collectLogs(query);

                if (entries != null && !entries.isEmpty()) {
                    return new LogResult(query.tagId(), entries, warnings);
                }
            } catch (RuntimeException error) {
                warnings.add(collector.name() + ": " + error.getMessage());
            }
        }

        if (warnings.isEmpty()) {
            warnings.add("log collector returned no data");
        }

        return new LogResult(query.tagId(), List.of(), warnings);
    }

    public TraceSnapshot getTrace(String traceId, List<String> tagIds) {
        for (Collector collector : registry.byCapability(Signal.TRACE)) {
            try {
                TraceSnapshot trace = collector.collectTrace(traceId, tagIds);

                if (trace != null) {
                    return trace;
                }
            } catch (RuntimeException error) {
                log.warn("[observability] trace failed for {}: {}",
                        collector.name(), error.getMessage());
            }
        }

        return null;
    }

    public List<TraceSnapshot> getRecentTraces(int limit, List<String> tagIds) {
        for (Collector collector : registry.byCapability(Signal.TRACE)) {
            try {
                List<TraceSnapshot> traces = collector.collectRecentTraces(limit, tagIds);

                if (traces != null && !traces.isEmpty()) {
                    return traces;
                }
            } catch (RuntimeException error) {
                log.warn("[observability] recent traces failed for {}: {}",
                        collector.name(), error.getMessage());
            }
        }

        return List.of();
    }

    /** 鍚勯噰闆嗗櫒杩為€氭€?*/
    public Map<String, Object> health(long graphVersion) {
        List<Map<String, Object>> entries = registry.all().stream()
                .map(collector -> {
                    Map<String, Object> entry = new java.util.LinkedHashMap<>();
                    entry.put("name", collector.name());

                    try {
                        HealthCheck check = collector.health();
                        entry.put("ok", check.ok());
                        entry.put("detail", check.detail());
                    } catch (RuntimeException error) {
                        entry.put("ok", false);
                        entry.put("detail", error.getMessage());
                    }

                    return entry;
                })
                .toList();

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("ok", !entries.isEmpty()
                && entries.stream().allMatch(entry -> Boolean.TRUE.equals(entry.get("ok"))));
        result.put("graphVersion", graphVersion);
        result.put("collectors", entries);

        return result;
    }
}
