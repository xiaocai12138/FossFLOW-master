package com.fossflow.backend.observability.model;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * tag_id 生成与校验规则。
 * 与前端 packages/fossflow-app/src/services/runtime/tagMapping.ts 保持一致。
 */
public final class TagIds {

    private TagIds() {}

    private static final Set<String> RESERVED_PREFIXES = Set.of("svc.", "inst.");
    private static final int MAX_LENGTH = 200;

    private static final Pattern NON_SAFE = Pattern.compile("[^a-z0-9._-]+");
    private static final Pattern MULTI_DASH = Pattern.compile("-+");
    private static final Pattern EDGE_DASH = Pattern.compile("^[-.]+|[-.]+$");

    /** 名称归一化：小写、非安全字符转连字符，保证 tag_id 稳定且 URL 安全 */
    public static String normalizeName(String value) {
        if (value == null) {
            return "";
        }

        String lowered = value.trim().toLowerCase();
        String replaced = NON_SAFE.matcher(lowered).replaceAll("-");
        String compact = MULTI_DASH.matcher(replaced).replaceAll("-");

        return EDGE_DASH.matcher(compact).replaceAll("");
    }

    /** 服务级 tag_id: svc.&lt;name&gt; */
    public static String serviceTagId(String name) {
        String normalized = normalizeName(name);

        return "svc." + (normalized.isEmpty() ? "unknown" : normalized);
    }

    /** 实例级 tag_id: inst.&lt;service&gt;.&lt;instance&gt; */
    public static String instanceTagId(String serviceName, String instance) {
        String svc = normalizeName(serviceName);
        String inst = normalizeName(instance);

        return "inst." + (svc.isEmpty() ? "unknown" : svc)
                + "." + (inst.isEmpty() ? "unknown" : inst);
    }

    /** 基础格式校验，避免把任意字符串写进库 */
    public static boolean isWellFormed(String tagId) {
        if (tagId == null) {
            return false;
        }

        String trimmed = tagId.trim();

        if (trimmed.isEmpty() || trimmed.length() > MAX_LENGTH) {
            return false;
        }

        return RESERVED_PREFIXES.stream().anyMatch(trimmed::startsWith);
    }
}
