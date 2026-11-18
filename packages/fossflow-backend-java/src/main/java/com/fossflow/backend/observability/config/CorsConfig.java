package com.fossflow.backend.observability.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 开发期跨域支持：前端 dev server 与后端不同源，浏览器需要 CORS 头。
 *
 * 默认放开全部来源（含 192.168.x.x 这类内网地址），因此用 allowedOriginPatterns
 * 而不是 allowedOrigins —— 后者与 allowCredentials=true 组合会被 Spring 拒绝。
 * 生产部署时应把 app.cors.allowed-origins 收窄到具体域名。
 *
 * 注意：allowedMethods 必须覆盖所有真实使用的动词。曾只列 GET/POST/OPTIONS，
 * 导致带 Origin 头的 PUT 被 Spring 判为非法跨域而 403（POST 却正常），
 * 表现为「保存成功、更新失败」。
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final List<String> allowedOrigins;

    public CorsConfig(
            @Value("${fossflow.cors.allowed-origins:*}") List<String> allowedOrigins) {
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("ETag")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
