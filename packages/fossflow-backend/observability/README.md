# Observability 模块

统一的图模型 + 遥测编排层。**前端只依赖 Canonical Model，上游（SkyWalking / Prometheus / 自研）只在 Collector 里出现。**

## 分层

```
SkyWalking ─┐
Prometheus ─┼─→ Collector ─→ Service(编排) ─→ Router ─→ /api/observability/*
自研框架   ─┘   (翻译)        仓储(元数据)
```

## 职责边界

| 数据 | 存储 |
| --- | --- |
| 服务目录、绑定关系、图边、健康状态 | 关系库（`memory` / `sqlite`） |
| 日志 | ES / Loki（写入时带 `tag_id`） |
| 指标 | Prometheus（label `tag_id`） |
| Trace | SkyWalking（`serviceCode` 经绑定表转 `tag_id`） |

> 关系库**不存**日志与指标，只存元数据。

## tag_id 规则

- 服务：`svc.<normalized-name>`，例：`svc.order-service`
- 实例：`inst.<service>.<instance>`，例：`inst.order-service.pod-7d9f`
- 由后端生成，**不接受外部传入**，保证唯一且 URL 安全

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/observability/health` | 采集器连通性 + 图版本 |
| GET | `/api/observability/graph` | 图快照（节点 + 边），支持 `ETag` |
| GET | `/api/observability/tags` | 服务目录 |
| POST | `/api/observability/tags` | 登记服务，自动生成 `tag_id` |
| POST | `/api/observability/bindings` | 绑定外部标识 → `tag_id` |
| POST | `/api/observability/edges` | 上报图边（自研采集器 / 手工补录） |
| GET | `/api/observability/nodes/:tagId` | 节点详情 + 上下游 + 实例 |
| GET | `/api/observability/nodes/:tagId/metrics` | 指标（Prometheus） |
| GET | `/api/observability/nodes/:tagId/logs` | 日志（ES/Loki，未接入时降级返回 warnings） |
| GET | `/api/observability/traces/:traceId` | Trace 详情，`path` 可直接用于图高亮 |
| POST | `/api/observability/sync` | 手动触发拓扑同步 |

统一响应：成功 `{ data }`，失败 `{ error: { code, message } }`。

## 新增一个采集器（3 步）

1. 在 `collectors/` 下实现：

```js
export const createMyCollector = (config) => ({
  name: 'my-agent',
  emissions: ['GRAPH', 'METRIC', 'LOG', 'TRACE'], // 按需
  async health() { return { ok: true }; },
  async collectGraph() { return { nodes: [], edges: [] }; },
  async collectMetrics({ tagId, names }) { return []; },
  async collectTrace(traceId) { return null; }
});
```

2. 在 `collectors/index.js` 里按配置装配。
3. 在 `OBS_COLLECTORS` 里加上名字。

返回的对象必须是 `model.js` 中的 `createNode` / `createEdge` 结构，**不要**把上游字段透传出来。

## 启用

```env
ENABLE_OBSERVABILITY=true
OBS_DB_DRIVER=sqlite          # or memory
OBS_COLLECTORS=skywalking,prometheus
OBS_SKYWALKING_URL=http://skywalking-oap:12800
OBS_PROM_URL=http://prometheus:9090
```

关闭时路由完全不挂载，不影响原有 `/api/diagrams` 存储接口。

## 已知限制

- `sqlite` 驱动依赖 Node 22 的 `node:sqlite`（实验特性），Node < 22 会自动回落到 `memory`
- Postgres 适配未实现，`repository.js` 已预留驱动入口
- 日志 Collector 未接入，当前返回空结果 + `warnings`
- SkyWalking 的 `Duration` 使用 OAP 服务器时区，需保证部署时区一致
