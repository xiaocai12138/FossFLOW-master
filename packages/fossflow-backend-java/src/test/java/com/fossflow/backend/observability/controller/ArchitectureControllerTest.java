package com.fossflow.backend.observability.controller;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.emptyOrNullString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 后台架构存储接口的契约测试。
 *
 * 用真实的 JPA + 内存 H2 跑，证明「保存 → 再读」不是内存里的假数据；
 * 请求体用最小合法 DiagramData，避免测试与画布细节耦合。
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:architecture-test;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class ArchitectureControllerTest {

    private static final String PATH = "/api/observability/architectures";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String body(String title, String diagramJson) {
        return "{\"title\":" + quote(title) + ",\"diagram\":" + diagramJson + "}";
    }

    private static String quote(String value) {
        return "\"" + value.replace("\"", "\\\"") + "\"";
    }

    private String create(String title, String diagramJson) throws Exception {
        MvcResult result = mockMvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(title, diagramJson)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id", not(emptyOrNullString())))
                .andReturn();

        JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());

        return payload.path("data").path("id").asText();
    }

    @Test
    @DisplayName("创建架构返回 201 与服务器生成的 id")
    void createsArchitecture() throws Exception {
        mockMvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("  MSC 靶场  ", "{\"items\":[],\"views\":[]}")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("MSC 靶场"))
                .andExpect(jsonPath("$.data.diagram.items").isArray())
                .andExpect(jsonPath("$.data.updatedAt", not(emptyOrNullString())));
    }

    @Test
    @DisplayName("按 ID 读回的 diagram 与保存内容一致（真实持久化往返）")
    void readsBackSameDiagram() throws Exception {
        String diagram = "{\"items\":[{\"id\":\"svc.msc-gateway\",\"name\":\"msc-gateway\","
                + "\"icon\":\"router\",\"tag\":\"svc.msc-gateway\"}],"
                + "\"views\":[{\"id\":\"v1\",\"name\":\"主视图\",\"items\":[],\"connectors\":[]}],"
                + "\"fitToView\":true}";

        String id = create("MSC 往返", diagram);

        mockMvc.perform(get(PATH + "/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.diagram.items[0].icon").value("router"))
                .andExpect(jsonPath("$.data.diagram.views[0].name").value("主视图"))
                .andExpect(jsonPath("$.data.diagram.fitToView").value(true));
    }

    @Test
    @DisplayName("列表只返回摘要，不携带整份 diagram")
    void listsSummariesOnly() throws Exception {
        String id = create("MSC 列表", "{\"items\":[]}");

        mockMvc.perform(get(PATH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(org.hamcrest.Matchers.greaterThan(0))))
                .andExpect(jsonPath("$.data[?(@.id == '" + id + "')].title")
                        .value("MSC 列表"))
                .andExpect(jsonPath("$.data[?(@.id == '" + id + "')].diagram").isEmpty());
    }

    @Test
    @DisplayName("更新同一 ID 后标题与 diagram 都被替换")
    void updatesSameArchitecture() throws Exception {
        String id = create("MSC 旧标题", "{\"items\":[],\"fitToView\":true}");

        mockMvc.perform(put(PATH + "/" + id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("MSC 新标题", "{\"items\":[{\"id\":\"a\",\"name\":\"A\"}]}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(id))
                .andExpect(jsonPath("$.data.title").value("MSC 新标题"))
                .andExpect(jsonPath("$.data.diagram.items[0].id").value("a"));

        mockMvc.perform(get(PATH + "/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("MSC 新标题"));
    }

    @Test
    @DisplayName("未知 ID 返回 404 与统一错误码")
    void missingArchitectureReturns404() throws Exception {
        mockMvc.perform(get(PATH + "/no-such-architecture"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));

        mockMvc.perform(put(PATH + "/no-such-architecture")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("x", "{}")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("空标题被拒绝")
    void rejectsBlankTitle() throws Exception {
        mockMvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("   ", "{}")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_ARGUMENT"));
    }

    @Test
    @DisplayName("diagram 不是对象时被拒绝，避免存进无法加载的载荷")
    void rejectsNonObjectDiagram() throws Exception {
        mockMvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("MSC", "[]")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_ARGUMENT"));

        mockMvc.perform(post(PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("MSC", "\"not-an-object\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_ARGUMENT"));
    }
}
