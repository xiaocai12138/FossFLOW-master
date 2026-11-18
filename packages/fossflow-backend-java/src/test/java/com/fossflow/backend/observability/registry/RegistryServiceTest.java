package com.fossflow.backend.observability.registry;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 编排层行为：source 解析优先级、未知源报错、健康探测失败不拖垮下拉列表。
 * 这里用最小的假实现，不依赖任何注册中心产品。
 */
class RegistryServiceTest {

    /** 只回放固定目录的假源，用来隔离编排层与真实 HTTP */
    private static final class StubSource implements RegistrySource {

        private final String name;
        private final RegistryHealth health;
        private final boolean explodeOnHealth;

        StubSource(String name) {
            this(name, RegistryHealth.ok("stub ok"), false);
        }

        StubSource(String name, RegistryHealth health, boolean explodeOnHealth) {
            this.name = name;
            this.health = health;
            this.explodeOnHealth = explodeOnHealth;
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public String displayName() {
            return name + "-display";
        }

        @Override
        public RegistryHealth health() {
            if (explodeOnHealth) {
                throw new IllegalStateException("boom");
            }

            return health;
        }

        @Override
        public RegistryCatalog fetch(RegistryQuery query) {
            return new RegistryCatalog(
                    name,
                    Instant.EPOCH,
                    List.of(new RegistryNode(
                            "svc.demo", null, "demo", null, Map.of(), List.of())),
                    List.of(),
                    List.of("from " + name));
        }
    }

    private List<Map<String, Object>> listSources(RegistryService service) {
        return service.listSources();
    }

    @Test
    @DisplayName("缺省 source 时使用配置的 default-source")
    void fallsBackToConfiguredDefault() {
        RegistryService service = new RegistryService(
                List.of(new StubSource("alpha"), new StubSource("beta")), "beta");

        RegistryCatalog catalog = service.fetch(null, RegistryQuery.defaults());

        assertThat(catalog.source()).isEqualTo("beta");
    }

    @Test
    @DisplayName("空白 source 同样走 default-source，不当成显式指定")
    void blankSourceUsesDefault() {
        RegistryService service = new RegistryService(
                List.of(new StubSource("alpha"), new StubSource("beta")), "alpha");

        assertThat(service.fetch("   ", RegistryQuery.defaults()).source())
                .isEqualTo("alpha");
    }

    @Test
    @DisplayName("显式 source 优先于 default-source")
    void explicitSourceWins() {
        RegistryService service = new RegistryService(
                List.of(new StubSource("alpha"), new StubSource("beta")), "alpha");

        assertThat(service.fetch("beta", RegistryQuery.defaults()).source())
                .isEqualTo("beta");
    }

    @Test
    @DisplayName("未知 source 抛 RegistryException(UNKNOWN_SOURCE)")
    void unknownSourceThrows() {
        RegistryService service = new RegistryService(List.of(new StubSource("alpha")), "alpha");

        assertThatThrownBy(() -> service.fetch("consul", RegistryQuery.defaults()))
                .isInstanceOf(RegistryException.class)
                .satisfies(error -> assertThat(((RegistryException) error).code())
                        .isEqualTo("UNKNOWN_SOURCE"))
                .hasMessageContaining("consul");
    }

    @Test
    @DisplayName("default-source 指向不存在的实现时也抛 UNKNOWN_SOURCE")
    void unknownDefaultSourceThrows() {
        RegistryService service = new RegistryService(List.of(new StubSource("alpha")), "missing");

        assertThatThrownBy(() -> service.fetch(null, RegistryQuery.defaults()))
                .isInstanceOf(RegistryException.class)
                .hasMessageContaining("missing");
    }

    @Test
    @DisplayName("listSources 列出所有源，并标出默认源")
    void listSourcesMarksDefault() {
        RegistryService service = new RegistryService(
                List.of(new StubSource("alpha"), new StubSource("beta")), "beta");

        List<Map<String, Object>> sources = listSources(service);

        assertThat(sources).hasSize(2);
        assertThat(sources).extracting(item -> item.get("name"))
                .containsExactly("alpha", "beta");
        assertThat(sources).extracting(item -> item.get("displayName"))
                .containsExactly("alpha-display", "beta-display");

        assertThat(sources)
                .filteredOn(item -> Boolean.TRUE.equals(item.get("isDefault")))
                .extracting(item -> item.get("name"))
                .containsExactly("beta");
    }

    @Test
    @DisplayName("某个源 health 抛异常时降级为 ok=false，不影响其它源")
    void listSourcesSurvivesBrokenHealth() {
        RegistryService service = new RegistryService(
                List.of(
                        new StubSource("broken", RegistryHealth.ok("x"), true),
                        new StubSource("alpha")),
                "alpha");

        List<Map<String, Object>> sources = listSources(service);

        assertThat(sources).hasSize(2);

        Map<String, Object> broken = sources.get(0);
        assertThat(broken.get("ok")).isEqualTo(false);
        assertThat(broken.get("detail")).asString().doesNotContain("boom");

        assertThat(sources.get(1).get("ok")).isEqualTo(true);
    }

    @Test
    @DisplayName("health 报告失败时 ok=false 但源依然留在下拉列表里")
    void listSourcesKeepsUnhealthySource() {
        RegistryService service = new RegistryService(
                List.of(new StubSource("alpha", RegistryHealth.failed("no route"), false)),
                "alpha");

        Map<String, Object> item = listSources(service).get(0);

        assertThat(item.get("name")).isEqualTo("alpha");
        assertThat(item.get("ok")).isEqualTo(false);
        assertThat(item.get("detail")).isEqualTo("no route");
    }

    @Test
    @DisplayName("没有注册任何实现时，列表为空且拉取抛 UNKNOWN_SOURCE")
    void handlesNoSources() {
        RegistryService service = new RegistryService(List.of(), "alpha");

        assertThat(service.listSources()).isEmpty();
        assertThatThrownBy(() -> service.fetch(null, RegistryQuery.defaults()))
                .isInstanceOf(RegistryException.class);
    }
}
