package com.fossflow.backend.observability.registry;

/** 注册源连通性自检结果。detail 只放可展示信息，不泄露内部地址 */
public record RegistryHealth(boolean ok, String detail) {

    public static RegistryHealth ok(String detail) {
        return new RegistryHealth(true, detail);
    }

    public static RegistryHealth failed(String detail) {
        return new RegistryHealth(false, detail);
    }
}
