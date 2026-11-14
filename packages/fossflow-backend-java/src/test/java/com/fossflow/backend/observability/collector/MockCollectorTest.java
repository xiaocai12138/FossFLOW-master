package com.fossflow.backend.observability.collector;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MockCollectorTest {

    private final MockCollector collector = new MockCollector();

    @Test
    @DisplayName("拓扑包含服务与边")
    void collectGraph() {
        GraphSnapshot graph = collector.collectGraph();

        assertThat(graph.nodes()).hasSize(6);
        assertThat(graph.edges()).hasSize(5);
        assertThat(graph.nodes())
                .allSatisfy(node -> assertThat(node.tagId()).startsWith("svc."));
    }

    @Test
    @DisplayName("实例层挂在服务节点下")
    void collectInstances() {
        var instances = collector.collectInstances();

        assertThat(instances).isNotEmpty();
        assertThat(instances).allSatisfy(instance -> {
            assertThat(instance.tagId()).startsWith("inst.");
            assertThat(instance.parentTagId()).startsWith("svc.");
        });
    }

    @Test
    @DisplayName("指标确定且落在合理区间")
    void collectMetrics() {
        var first = collector.collectMetrics("svc.order-service", null);
        var second = collector.collectMetrics("svc.order-service", null);

        assertThat(first).isNotEmpty();
        assertThat(first).isEqualTo(second);
        assertThat(first).allSatisfy(
                point -> assertThat(point.value()).isGreaterThanOrEqualTo(0.0));
    }

    @Test
    @DisplayName("链路沿传入的 tagIds 生成，便于图高亮")
    void collectTraceFollowsTagIds() {
        List<String> tags = List.of("svc.web", "svc.checkout", "svc.redis");
        TraceSnapshot trace = collector.collectTrace("trace-1", tags);

        assertThat(trace.spans()).hasSize(3);
        assertThat(trace.path()).isEqualTo(List.of(
                new PathNode("svc.web", "1"),
                new PathNode("svc.checkout", "2"),
                new PathNode("svc.redis", "3")));
    }

    @Test
    @DisplayName("recent traces 不会因为上下文丢失返回空数组")
    void collectRecentTracesNotEmpty() {
        var traces = collector.collectRecentTraces(3, List.of("svc.a", "svc.b"));

        assertThat(traces).hasSize(3);
        assertThat(traces).allSatisfy(trace -> {
            assertThat(trace.traceId()).isNotBlank();
            assertThat(trace.spans()).hasSize(2);
        });
    }

    @Test
    @DisplayName("日志按级别过滤生效")
    void collectLogsFiltersLevel() {
        var entries = collector.collectLogs(new LogQuery("svc.order-service", null, "ERROR", 5));

        assertThat(entries).hasSize(5);
        assertThat(entries).allSatisfy(entry -> assertThat(entry.level()).isEqualTo("ERROR"));
    }
}
