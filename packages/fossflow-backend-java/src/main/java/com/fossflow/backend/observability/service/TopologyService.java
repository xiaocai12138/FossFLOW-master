package com.fossflow.backend.observability.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fossflow.backend.observability.collector.Collector;
import com.fossflow.backend.observability.collector.EdgeSnapshot;
import com.fossflow.backend.observability.collector.GraphSnapshot;
import com.fossflow.backend.observability.collector.NodeSnapshot;
import com.fossflow.backend.observability.collector.Signal;
import com.fossflow.backend.observability.dto.GraphView;
import com.fossflow.backend.observability.dto.SyncResult;
import com.fossflow.backend.observability.entity.ObsEdge;
import com.fossflow.backend.observability.entity.ObsEdgeKey;
import com.fossflow.backend.observability.entity.ObsTag;
import com.fossflow.backend.observability.entity.ObsTagBinding;
import com.fossflow.backend.observability.mapper.GraphViewMapper;
import com.fossflow.backend.observability.mapper.LabelCodec;
import com.fossflow.backend.observability.model.EdgeKind;
import com.fossflow.backend.observability.model.Health;
import com.fossflow.backend.observability.model.NodeKind;
import com.fossflow.backend.observability.model.TagIds;
import com.fossflow.backend.observability.repository.ObsEdgeRepository;
import com.fossflow.backend.observability.repository.ObsTagBindingRepository;
import com.fossflow.backend.observability.repository.ObsTagRepository;

/** 鎷撴墤锛堝浘锛夌殑鍚屾涓庢煡璇?*/
@Service
public class TopologyService {

    private static final Logger log = LoggerFactory.getLogger(TopologyService.class);

    private final ObsTagRepository tagRepository;
    private final ObsTagBindingRepository bindingRepository;
    private final ObsEdgeRepository edgeRepository;
    private final CollectorRegistry registry;
    private final GraphVersionService versionService;
    private final GraphViewMapper viewMapper;
    private final LabelCodec labelCodec;

    public TopologyService(
            ObsTagRepository tagRepository,
            ObsTagBindingRepository bindingRepository,
            ObsEdgeRepository edgeRepository,
            CollectorRegistry registry,
            GraphVersionService versionService,
            GraphViewMapper viewMapper,
            LabelCodec labelCodec) {
        this.tagRepository = tagRepository;
        this.bindingRepository = bindingRepository;
        this.edgeRepository = edgeRepository;
        this.registry = registry;
        this.versionService = versionService;
        this.viewMapper = viewMapper;
        this.labelCodec = labelCodec;
    }

    private String resolveEnv(String env) {
        return env == null || env.isBlank() ? versionService.defaultEnv() : env;
    }

    /* ----------------------------- 鍚屾 ----------------------------- */

    @Transactional
    public SyncResult syncTopology() {
        int nodeCount = 0;
        int edgeCount = 0;
        List<Map<String, Object>> collectorResults = new ArrayList<>();

        for (Collector collector : registry.byCapability(Signal.GRAPH)) {
            try {
                GraphSnapshot graph = collector.collectGraph();
                List<NodeSnapshot> instances = collector.collectInstances();

                List<NodeSnapshot> all = new ArrayList<>(graph.nodes());
                all.addAll(instances);

                for (NodeSnapshot snapshot : all) {
                    upsertNode(snapshot);
                    nodeCount++;
                }

                for (EdgeSnapshot edge : graph.edges()) {
                    upsertEdge(edge);
                    edgeCount++;
                }

                collectorResults.add(Map.of("name", collector.name(), "ok", true));
            } catch (RuntimeException error) {
                log.error("[observability] sync failed for {}", collector.name(), error);
                collectorResults.add(Map.of(
                        "name", collector.name(),
                        "ok", false,
                        "detail", String.valueOf(error.getMessage())));
            }
        }

        if (nodeCount > 0 || edgeCount > 0) {
            versionService.bump();
        }

        return new SyncResult(nodeCount, edgeCount, collectorResults);
    }

    private void upsertNode(NodeSnapshot snapshot) {
        ObsTag tag = tagRepository.findById(snapshot.tagId()).orElseGet(
                () -> new ObsTag(
                        snapshot.tagId(),
                        snapshot.kind(),
                        snapshot.name(),
                        versionService.defaultEnv()));

        tag.setName(snapshot.name());
        tag.setKind(snapshot.kind());
        tag.setParentTagId(snapshot.parentTagId());
        tag.setLabels(labelCodec.encode(snapshot.labels()));
        tag.setHealth(tag.getHealth() == null
                ? snapshot.health()
                : Health.worse(tag.getHealth(), snapshot.health()));
        tag.setLastSeen(Instant.now());

        tagRepository.save(tag);
    }

    private void upsertEdge(EdgeSnapshot snapshot) {
        EdgeKind kind = snapshot.kind() == null ? EdgeKind.CALL : snapshot.kind();
        String env = versionService.defaultEnv();

        ObsEdge edge = edgeRepository
                .findById(new ObsEdgeKey(snapshot.fromTag(), snapshot.toTag(), kind, env))
                .orElseGet(() -> new ObsEdge(snapshot.fromTag(), snapshot.toTag(), env));

        edge.setKind(kind);

        if (snapshot.callsPerMin() != null) {
            edge.setCallsPerMin(snapshot.callsPerMin());
        }

        if (snapshot.errorRate() != null) {
            edge.setErrorRate(snapshot.errorRate());
        }

        if (snapshot.p95Ms() != null) {
            edge.setP95Ms(snapshot.p95Ms());
        }

        edge.setUpdatedAt(Instant.now());
        edgeRepository.save(edge);
    }

    /* ----------------------------- 鏌ヨ ----------------------------- */

    @Transactional(readOnly = true)
    public GraphView getGraph(String env) {
        String targetEnv = resolveEnv(env);
        List<ObsTag> tags = tagRepository.findByEnv(targetEnv);
        List<ObsEdge> edges = edgeRepository.findByEnv(targetEnv);

        List<Map<String, Object>> nodes = tags.stream()
                .map(viewMapper::toNodeView)
                .toList();

        List<Map<String, Object>> edgeViews = edges.stream()
                .map(viewMapper::toEdgeView)
                .toList();

        return new GraphView(
                versionService.current(),
                targetEnv,
                Instant.now().toEpochMilli(),
                nodes,
                edgeViews);
    }

    @Transactional(readOnly = true)
    public List<ObsTag> listTags(String env) {
        return tagRepository.findByEnv(resolveEnv(env));
    }

    @Transactional(readOnly = true)
    public Optional<ObsTag> findTag(String tagId) {
        return tagRepository.findById(tagId);
    }

    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> getNode(String tagId) {
        return tagRepository.findById(tagId).map(tag -> viewMapper.toNodeDetail(
                tag,
                bindingRepository.findByTagId(tagId).stream()
                        .map(binding -> viewMapper.toBindingView(
                                binding.getSource(),
                                binding.getExternalId(),
                                binding.getTagId()))
                        .toList(),
                tagRepository.findByParentTagId(tagId).stream()
                        .map(ObsTag::getTagId)
                        .toList(),
                edgeRepository.findByToTag(tagId).stream()
                        .map(ObsEdge::getFromTag)
                        .toList(),
                edgeRepository.findByFromTag(tagId).stream()
                        .map(ObsEdge::getToTag)
                        .toList()));
    }

    /* ----------------------------- 鍐欏叆 ----------------------------- */

    @Transactional
    public ObsTag registerTag(String name, NodeKind kind, String env,
            Map<String, String> labels, String parentTagId) {

        String targetEnv = resolveEnv(env);
        String tagId = (kind == NodeKind.INSTANCE && parentTagId != null)
                ? parentTagId.replaceFirst("^svc\\.", "inst.") + "."
                        + TagIds.normalizeName(name)
                : TagIds.serviceTagId(name);

        ObsTag tag = tagRepository.findById(tagId)
                .orElseGet(() -> new ObsTag(tagId, kind, name, targetEnv));

        tag.setName(name);
        tag.setKind(kind);
        tag.setEnv(targetEnv);
        tag.setParentTagId(parentTagId);
        tag.setLabels(labelCodec.encode(labels));
        tag.setLastSeen(Instant.now());

        ObsTag saved = tagRepository.save(tag);
        versionService.bump();

        return saved;
    }

    @Transactional
    public void bind(String source, String externalId, String tagId) {
        bindingRepository.findBySourceAndExternalId(source, externalId)
                .ifPresentOrElse(
                        existing -> {
                            existing.setTagId(tagId);
                            bindingRepository.save(existing);
                        },
                        () -> bindingRepository.save(
                                new ObsTagBinding(source, externalId, tagId)));
    }

    @Transactional
    public ObsEdge upsertEdge(String fromTag, String toTag, EdgeKind kind, String env,
            Double callsPerMin, Double errorRate, Double p95Ms) {

        EdgeKind resolvedKind = kind == null ? EdgeKind.CALL : kind;
        String targetEnv = resolveEnv(env);

        ObsEdge edge = edgeRepository
                .findById(new ObsEdgeKey(fromTag, toTag, resolvedKind, targetEnv))
                .orElseGet(() -> new ObsEdge(fromTag, toTag, targetEnv));

        edge.setKind(resolvedKind);
        edge.setCallsPerMin(callsPerMin);
        edge.setErrorRate(errorRate);
        edge.setP95Ms(p95Ms);
        edge.setUpdatedAt(Instant.now());

        ObsEdge saved = edgeRepository.save(edge);
        versionService.bump();

        return saved;
    }
}
