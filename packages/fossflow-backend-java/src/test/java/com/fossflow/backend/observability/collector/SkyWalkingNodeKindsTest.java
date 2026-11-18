package com.fossflow.backend.observability.collector;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import com.fossflow.backend.observability.model.NodeKind;

class SkyWalkingNodeKindsTest {

    @ParameterizedTest
    @DisplayName("中间件按关键字归类到对应 NodeKind")
    @CsvSource({
        "MySQL,            DATABASE",
        "PostgreSQL,       DATABASE",
        "Elasticsearch,    DATABASE",
        "Redis,            CACHE",
        "Memcached,        CACHE",
        "Kafka,            MQ",
        "RabbitMQ,         MQ",
        "RocketMQ,         MQ",
        "Spring Cloud Gateway, GATEWAY",
        "APISIX,           GATEWAY",
        "Nginx,            GATEWAY"
    })
    void mapsMiddleware(String swType, NodeKind expected) {
        assertThat(SkyWalkingNodeKinds.map(swType, true)).isEqualTo(expected);
    }

    @Test
    @DisplayName("大小写不敏感")
    void caseInsensitive() {
        assertThat(SkyWalkingNodeKinds.map("mySQL", true)).isEqualTo(NodeKind.DATABASE);
        assertThat(SkyWalkingNodeKinds.map("rEdIs", true)).isEqualTo(NodeKind.CACHE);
    }

    @Test
    @DisplayName("空 type 且为真实节点时视为 SERVICE")
    void emptyTypeRealNode() {
        assertThat(SkyWalkingNodeKinds.map("", true)).isEqualTo(NodeKind.SERVICE);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @DisplayName("空 type 且非真实节点时视为 EXTERNAL")
    void emptyTypeConjecturalNode(String type) {
        assertThat(SkyWalkingNodeKinds.map(type, false)).isEqualTo(NodeKind.EXTERNAL);
    }

    @Test
    @DisplayName("OAP 的用户入口节点 type=User 映射为 EXTERNAL")
    void userNodeIsExternal() {
        assertThat(SkyWalkingNodeKinds.map("User", false)).isEqualTo(NodeKind.EXTERNAL);
        assertThat(SkyWalkingNodeKinds.map("User", true)).isEqualTo(NodeKind.EXTERNAL);
    }

    @Test
    @DisplayName("非真实节点即使带中间件 type 也归为 EXTERNAL")
    void conjecturalNodeIsExternal() {
        assertThat(SkyWalkingNodeKinds.map("unknown-tech", false)).isEqualTo(NodeKind.EXTERNAL);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Tomcat", "SpringMVC", "Dubbo", "gRPC", "HttpServer"})
    @DisplayName("普通技术栈组件保持 SERVICE，避免被误判成外部依赖")
    void ordinaryComponentsStayService(String swType) {
        assertThat(SkyWalkingNodeKinds.map(swType, true)).isEqualTo(NodeKind.SERVICE);
    }
}
