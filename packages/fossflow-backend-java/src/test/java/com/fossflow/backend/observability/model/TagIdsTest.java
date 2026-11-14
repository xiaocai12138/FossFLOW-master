package com.fossflow.backend.observability.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TagIdsTest {

    @Test
    @DisplayName("normalizeName 与前端 tagMapping 规则一致")
    void normalizeName() {
        assertThat(TagIds.normalizeName("Order Service")).isEqualTo("order-service");
        assertThat(TagIds.normalizeName("  api_gateway  ")).isEqualTo("api_gateway");
        assertThat(TagIds.normalizeName("svc//db")).isEqualTo("svc-db");
        assertThat(TagIds.normalizeName("--edge--")).isEqualTo("edge");
        assertThat(TagIds.normalizeName(null)).isEmpty();
    }

    @Test
    @DisplayName("服务与实例 tag_id 使用 svc./inst. 前缀")
    void tagIds() {
        assertThat(TagIds.serviceTagId("order-service")).isEqualTo("svc.order-service");
        assertThat(TagIds.serviceTagId("Order Service")).isEqualTo("svc.order-service");
        assertThat(TagIds.serviceTagId("")).isEqualTo("svc.unknown");

        assertThat(TagIds.instanceTagId("order-service", "pod-7d9f"))
                .isEqualTo("inst.order-service.pod-7d9f");
    }

    @Test
    @DisplayName("拒绝非预期格式的 tag_id")
    void tagIdValidation() {
        assertThat(TagIds.isWellFormed("svc.order-service")).isTrue();
        assertThat(TagIds.isWellFormed("inst.order-service.pod-1")).isTrue();
        assertThat(TagIds.isWellFormed("order-service")).isFalse();
        assertThat(TagIds.isWellFormed("")).isFalse();
        assertThat(TagIds.isWellFormed(null)).isFalse();
    }
}
