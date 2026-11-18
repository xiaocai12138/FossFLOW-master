package com.fossflow.backend.observability.registry;

/**
 * 服务注册目录来源契约。
 *
 * 这是「外部基础设施只许出现在承接层」原则的落点：上层（RegistryService、
 * RegistryController、前端）只认识 RegistryCatalog，不认识任何注册中心产品名。
 * 新增一个注册中心 = 新增一个实现类 + 一行配置，其余构建单元不动。
 */
public interface RegistrySource {

    /** 稳定短名，前端 URL 参数用它，如各实现自定义的标识 */
    String name();

    /** 人类可读名称，前端下拉展示 */
    String displayName();

    /** 连通性自检 */
    RegistryHealth health();

    /** 拉取服务目录 */
    RegistryCatalog fetch(RegistryQuery query);
}
