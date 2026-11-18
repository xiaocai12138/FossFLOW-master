package com.fossflow.backend.observability.config;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * CORS 覆盖真实使用的动词。
 *
 * 回归背景：allowedMethods 曾只列 GET/POST/OPTIONS，浏览器带 Origin 头的 PUT
 * 被 Spring 以「Invalid CORS request」403 拒绝，而 POST 正常——
 * 表现为后台架构「首次保存成功、后续更新失败」。
 */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:cors-test;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class CorsConfigTest {

    private static final String ORIGIN = "http://192.168.1.110:8090";

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("跨域预检允许 PUT")
    void preflightAllowsPut() throws Exception {
        mockMvc.perform(options("/api/observability/architectures/abc")
                        .header(HttpHeaders.ORIGIN, ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "PUT")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ORIGIN));
    }

    @Test
    @DisplayName("带 Origin 的 PUT 不被判为非法跨域")
    void actualPutWithOriginIsAccepted() throws Exception {
        // 目标是真实存在的 id 才会返回 404，这里只关心「不是 403 CORS 拒绝」
        mockMvc.perform(put("/api/observability/architectures/no-such-id")
                        .header(HttpHeaders.ORIGIN, ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"x\",\"diagram\":{\"items\":[]}}"))
                .andExpect(status().isNotFound())
                .andExpect(header().string(
                        HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ORIGIN));
    }

    @Test
    @DisplayName("跨域预检允许 DELETE，避免将来同类问题")
    void preflightAllowsDelete() throws Exception {
        mockMvc.perform(options("/api/observability/architectures/abc")
                        .header(HttpHeaders.ORIGIN, ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "DELETE"))
                .andExpect(status().isOk());
    }
}
