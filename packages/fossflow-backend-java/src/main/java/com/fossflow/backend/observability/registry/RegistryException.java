package com.fossflow.backend.observability.registry;

/**
 * 注册目录相关错误。消息会被直接返回给前端，
 * 因此只描述「哪个源、发生了什么事」，不携带上游地址与凭据。
 */
public class RegistryException extends RuntimeException {

    private final String code;

    public RegistryException(String message) {
        this("REGISTRY_ERROR", message, null);
    }

    public RegistryException(String message, Throwable cause) {
        this("REGISTRY_ERROR", message, cause);
    }

    public RegistryException(String code, String message) {
        this(code, message, null);
    }

    public RegistryException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static RegistryException unknownSource(String sourceName) {
        return new RegistryException(
                "UNKNOWN_SOURCE",
                "unknown registry source: " + (sourceName == null ? "" : sourceName));
    }
}
