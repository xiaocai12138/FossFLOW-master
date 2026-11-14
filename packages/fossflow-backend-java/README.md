# FossFLOW Backend (Spring Boot)

可观测性统一图模型服务。前端只依赖 Canonical Model，SkyWalking / Prometheus / 自研采集器都作为 Collector 接入。

## 技术栈

| 项 | 版本 |
| --- | --- |
| Java | 17 |
| Spring Boot | 3.3.5 |
| Spring Web (Tomcat) | 随 Boot |
| Spring Data JPA / Hibernate | 6.5.3 |
| 数据库 | H2 文件库（默认）/ PostgreSQL |
| 构建 | Maven |
| 测试 | JUnit 5 + AssertJ |

## 快速开始

```bash
# 开发运行
cd packages/fossflow-backend-java
mvn spring-boot:run

# 打包并运行
mvn -DskipTests package
java -jar target/fossflow-backend-1.5.1.jar

# 测试
mvn test
```

默认端口 `3001`，数据库文件位于 `<工作目录>/data/observability.mv.db`。

## 配置

```env
BACKEND_PORT=3001

# 数据库（默认 H2；生产建议 PostgreSQL）
DB_URL=jdbc:h2:file:${user.dir}/data/observability
DB_USERNAME=sa
DB_PASSWORD=
DB_DRIVER=org.h2.Driver

# PostgreSQL 示例
# DB_URL=jdbc:postgresql://localhost:5432/fossflow
# DB_DRIVER=org.postgresql.Driver
# DB_USERNAME=fossflow
# DB_PASSWORD=secret

# 环境标识与健康判定阈值
OBS_ENV=prod
OBS_ERR_WARN=5
OBS_ERR_CRIT=20
OBS_P95_WARN_MS=800
OBS_P95_CRIT_MS=2000
```

## 代码结构

按职责分包，**每个文件只放一个类型**：

```
com.fossflow.backend.observability/
├── model/          领域枚举与规则（无框架依赖）
│   ├── NodeKind / EdgeKind / Health
│   └── TagIds.java           tag_id 生成与校验
├── entity/         JPA 实体
│   ├── ObsTag / ObsEdge / ObsTagBinding / ObsMeta
│   └── ObsEdgeKey / ObsTagBindingKey   复合主键
├── repository/     Spring Data 仓储
├── collector/      采集器契约与快照类型
│   ├── Collector.java        唯一接口
│   ├── Signal / HealthCheck
│   ├── NodeSnapshot / EdgeSnapshot / GraphSnapshot
│   ├── MetricPoint / LogEntry / LogQuery
│   ├── SpanSnapshot / PathNode / TraceSnapshot
│   └── MockCollector.java
├── service/        业务编排
│   ├── TopologyService       图的同步与查询
│   ├── TelemetryService      指标/日志/链路
│   ├── CollectorRegistry     按信号筛选采集器
│   ├── HealthEvaluator       阈值判定
│   └── GraphVersionService   图版本号
├── mapper/         实体 → 视图
│   ├── GraphViewMapper
│   └── LabelCodec            labels JSON 编解码
├── dto/            { SyncResult, GraphView, LogResult }
└── controller/     REST 入口
    ├── TopologyController    /graph /tags /nodes /edges /sync
    ├── TelemetryController   /health /services /metrics /logs /traces
    └── Responses / BodyParsers
```

依赖方向单向：`controller → service → repository/mapper → entity/model`，`model` 不依赖任何框架。

## 领域模型

关系库**只存元数据**，日志与指标留在专用存储。

```
obs_tag           图节点（SERVICE / INSTANCE / DATABASE / ...）
obs_tag_binding   外部标识 → tag_id（SkyWalking serviceCode、Prom label）
obs_edge          图边 + 聚合值（callsPerMin / errorRate / p95Ms）
obs_meta          模块元数据（图版本号，用于 ETag）
```

`tag_id` 规则（与前端 `tagMapping.ts` 一致）：

- 服务：`svc.<normalized-name>` → `svc.order-service`
- 实例：`inst.<service>.<instance>` → `inst.order-service.pod-7d9f`

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/observability/health` | 采集器连通性 + 图版本 |
| GET | `/api/observability/graph` | 图快照，支持 `ETag` / 304 |
| GET | `/api/observability/tags` | 服务目录 |
| POST | `/api/observability/tags` | 登记节点，自动生成 tag_id |
| POST | `/api/observability/bindings` | 绑定外部标识 |
| POST | `/api/observability/edges` | 上报图边 |
| GET | `/api/observability/services?tagIds=a,b` | 批量状态 + 指标 |
| GET | `/api/observability/nodes/{tagId}` | 详情 + 上下游 + 实例 |
| GET | `/api/observability/nodes/{tagId}/metrics` | 指标 |
| GET | `/api/observability/nodes/{tagId}/logs` | 日志 |
| GET | `/api/observability/traces/recent?tagIds=` | 最近链路 |
| GET | `/api/observability/traces/{traceId}` | 链路详情 |
| POST | `/api/observability/sync` | 手动同步拓扑 |

统一响应：成功 `{"data": ...}`，失败 `{"error": {"code": "...", "message": "..."}}`。

## 扩展采集器

实现 `Collector` 接口并注册为 Spring Bean：

```java
@Component
public class SkyWalkingCollector implements Collector {
    public String name() { return "skywalking"; }
    public Signal[] emissions() { return new Signal[]{Signal.GRAPH, Signal.TRACE}; }
    public HealthCheck health() { ... }
    public GraphSnapshot collectGraph() { ... }
}
```

服务层会按 `emissions()` 自动编排，无需改动 Controller 或前端契约。

## 当前状态

- ✅ Canonical Model、JPA 仓储、REST 接口、Mock 采集器
- ✅ 图版本号 + ETag、健康阈值判定、H2 持久化
- ⏳ SkyWalking / Prometheus 真实采集器（未实现）
- ⏳ 鉴权与限流
