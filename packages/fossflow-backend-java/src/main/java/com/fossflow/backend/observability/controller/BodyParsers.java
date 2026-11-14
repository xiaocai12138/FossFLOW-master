package com.fossflow.backend.observability.controller;

import java.util.Map;
import java.util.stream.Collectors;

/** 请求体的轻量解析工具 */
public final class BodyParsers {

    private BodyParsers() {}

    public static Double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }

        return null;
    }

    public static Map<String, String> toStringMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return Map.of();
        }

        return map.entrySet().stream()
                .collect(Collectors.toMap(
                        entry -> String.valueOf(entry.getKey()),
                        entry -> String.valueOf(entry.getValue())));
    }
}
