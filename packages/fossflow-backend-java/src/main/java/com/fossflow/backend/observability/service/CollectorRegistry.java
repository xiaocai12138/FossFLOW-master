package com.fossflow.backend.observability.service;

import java.util.List;

import org.springframework.stereotype.Component;

import com.fossflow.backend.observability.collector.Collector;
import com.fossflow.backend.observability.collector.Signal;

/** 按信号能力筛选采集器，供各服务复用 */
@Component
public class CollectorRegistry {

    private final List<Collector> collectors;

    public CollectorRegistry(List<Collector> collectors) {
        this.collectors = collectors;
    }

    public List<Collector> all() {
        return collectors;
    }

    public List<Collector> byCapability(Signal signal) {
        return collectors.stream()
                .filter(collector -> List.of(collector.emissions()).contains(signal))
                .toList();
    }
}
