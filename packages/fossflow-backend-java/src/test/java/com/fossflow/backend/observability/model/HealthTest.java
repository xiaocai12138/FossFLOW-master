package com.fossflow.backend.observability.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HealthTest {

    @Test
    @DisplayName("多来源健康状态合并取更严重者")
    void worseHealth() {
        assertThat(Health.worse(Health.HEALTHY, Health.CRITICAL)).isEqualTo(Health.CRITICAL);
        assertThat(Health.worse(Health.CRITICAL, Health.HEALTHY)).isEqualTo(Health.CRITICAL);
        assertThat(Health.worse(Health.WARNING, Health.HEALTHY)).isEqualTo(Health.WARNING);
        assertThat(Health.worse(Health.OFFLINE, Health.CRITICAL)).isEqualTo(Health.OFFLINE);
        assertThat(Health.worse(null, Health.HEALTHY)).isEqualTo(Health.HEALTHY);
        assertThat(Health.worse(Health.HEALTHY, null)).isEqualTo(Health.HEALTHY);
    }
}
