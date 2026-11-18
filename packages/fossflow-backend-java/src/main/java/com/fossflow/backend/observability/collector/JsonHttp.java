package com.fossflow.backend.observability.collector;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * 采集器共享的 JSON over HTTP 工具。
 * 只做三件事：拼请求、校验状态码、把响应体解析成 JsonNode。
 * 非 2xx 统一抛 RuntimeException，由各采集器的 health()/调用方决定降级策略。
 */
public final class JsonHttp {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    private JsonHttp() {}

    public static JsonNode get(String url, Duration timeout) {
        return send(HttpRequest.newBuilder(URI.create(url))
                .timeout(timeout)
                .header("Accept", "application/json")
                .GET()
                .build());
    }

    public static JsonNode getText(String url, Duration timeout) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(timeout)
                .GET()
                .build();

        return MAPPER.getNodeFactory().textNode(execute(request));
    }

    public static JsonNode postJson(
            String url, Object body, Duration timeout, String bearerToken) {
        String payload;

        try {
            payload = MAPPER.writeValueAsString(body);
        } catch (IOException error) {
            throw new IllegalStateException("cannot serialize request body", error);
        }

        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(url))
                .timeout(timeout)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload));

        if (bearerToken != null && !bearerToken.isBlank()) {
            builder.header("Authorization", "Bearer " + bearerToken.trim());
        }

        return send(builder.build());
    }

    private static JsonNode send(HttpRequest request) {
        String body = execute(request);

        try {
            return MAPPER.readTree(body);
        } catch (IOException error) {
            throw new IllegalStateException(
                    "invalid JSON from " + request.uri().getHost(), error);
        }
    }

    private static String execute(HttpRequest request) {
        try {
            HttpResponse<String> response = CLIENT.send(
                    request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("HTTP " + response.statusCode()
                        + " from " + request.uri());
            }

            return response.body();
        } catch (IOException error) {
            throw new IllegalStateException(
                    "cannot reach " + request.uri().getHost() + ": " + error.getMessage(), error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();

            throw new IllegalStateException("interrupted calling " + request.uri().getHost());
        }
    }
}
