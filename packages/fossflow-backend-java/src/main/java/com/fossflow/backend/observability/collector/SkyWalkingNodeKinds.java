package com.fossflow.backend.observability.collector;

import com.fossflow.backend.observability.model.NodeKind;

/**
 * SkyWalking 节点 type → NodeKind 映射。
 *
 * OAP 的 Node.type 语义是「组件 / 中间件技术名」（如 Tomcat、SpringMVC、MySQL、Redis、Kafka），
 * 而不是架构角色。因此只能按关键字归类，无法做到精确的一一对应。
 * 未命中任何关键字时退化为 SERVICE，避免把真实服务画成外部依赖。
 */
final class SkyWalkingNodeKinds {

    private SkyWalkingNodeKinds() {}

    private static final String[] GATEWAY = {
        "gateway", "apisix", "kong", "nginx", "zuul", "higress",
        "envoy", "ingress", "traefik", "haproxy"
    };

    private static final String[] DATABASE = {
        "mysql", "postgres", "oracle", "mongo", "tidb", "sqlserver",
        "clickhouse", "database", "druid", "elasticsearch", "opensearch",
        "influxdb", "sqlite"
    };

    private static final String[] CACHE = {
        "redis", "memcache", "cache", "ignite", "couchbase"
    };

    private static final String[] MQ = {
        "kafka", "rabbitmq", "rocketmq", "pulsar", "activemq", "nats", "mq"
    };

    /**
     * @param type   SkyWalking Node.type，可能为空
     * @param isReal true 表示真实上报的节点；false 表示 OAP 生成的推测节点
     */
    static NodeKind map(String type, boolean isReal) {
        String normalized = type == null ? "" : type.trim().toLowerCase();

        if (normalized.isEmpty()) {
            // 非真实节点没有 type 时只可能是入口（User），保留可见而不是丢弃
            return isReal ? NodeKind.SERVICE : NodeKind.EXTERNAL;
        }

        if (matches(normalized, CACHE)) {
            return NodeKind.CACHE;
        }

        if (matches(normalized, MQ)) {
            return NodeKind.MQ;
        }

        if (matches(normalized, DATABASE)) {
            return NodeKind.DATABASE;
        }

        if (matches(normalized, GATEWAY)) {
            return NodeKind.GATEWAY;
        }

        // OAP 对用户入口节点固定下发 type="User" 且 isReal=false。
        // 这里保留为 EXTERNAL 而不是跳过：入口流量本身就是架构图的一部分，
        // 跳过会让「谁在调这个服务」永久缺失。
        if ("user".equals(normalized) || !isReal) {
            return NodeKind.EXTERNAL;
        }

        return NodeKind.SERVICE;
    }

    private static boolean matches(String value, String[] keywords) {
        for (String keyword : keywords) {
            if (value.contains(keyword)) {
                return true;
            }
        }

        return false;
    }
}
