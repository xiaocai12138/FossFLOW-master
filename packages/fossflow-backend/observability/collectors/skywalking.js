import {
  HEALTH,
  createEdge,
  createNode,
  instanceTagId,
  serviceTagId
} from '../model.js';

/**
 * SkyWalking OAP 采集器。
 * 负责：服务拓扑（初始化架构图）、Trace 明细。
 * 注意：SkyWalking 不产出系统指标，指标交给 Prometheus。
 */

const pad = (value) => String(value).padStart(2, '0');

/**
 * SkyWalking 的 Duration 使用 OAP 所在时区的 "YYYY-MM-DD HHmm"。
 * 这里按服务器本地时间格式化，部署时需保证 OAP 与采集器时区一致。
 */
const formatDuration = (windowMinutes) => {
  const end = new Date();
  const start = new Date(end.getTime() - windowMinutes * 60 * 1000);

  const fmt = (date) => {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ${pad(date.getHours())}${pad(date.getMinutes())}`;
  };

  return { start: fmt(start), end: fmt(end), step: 'MINUTE' };
};

export const createSkyWalkingCollector = ({
  url,
  token,
  windowMinutes = 15,
  env = 'prod'
}) => {
  const endpoint = `${String(url).replace(/\/+$/, '')}/graphql`;

  const request = async (query, variables) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`SkyWalking HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (payload.errors?.length) {
      throw new Error(`SkyWalking GraphQL: ${payload.errors[0].message}`);
    }

    return payload.data;
  };

  return {
    name: 'skywalking',
    emissions: ['GRAPH', 'TRACE'],

    async health() {
      try {
        await request('{ queryServices { name } }');

        return { ok: true };
      } catch (error) {
        return { ok: false, detail: error.message };
      }
    },

    /**
     * 服务级拓扑：节点 → SERVICE，调用 → CALL 边。
     * 这是架构图初始化的权威来源，比从 trace 统计更准。
     */
    async collectGraph() {
      const data = await request(
        `query GlobalTopology($duration: Duration!) {
           getGlobalTopology(duration: $duration) {
             nodes { id name type isReal }
             calls { source target }
           }
         }`,
        { duration: formatDuration(windowMinutes) }
      );

      const topology = data?.getGlobalTopology;

      if (!topology) return { nodes: [], edges: [] };

      // SkyWalking 的 node.id 与显示名可能不同，先建索引
      const tagBySkyWalkingId = new Map();
      const nodes = [];

      for (const node of topology.nodes ?? []) {
        // isReal=false 表示 User / 外部入口，跳过以免污染架构图
        if (node.isReal === false) continue;

        const tagId = serviceTagId(node.name);

        tagBySkyWalkingId.set(node.id, tagId);
        nodes.push(
          createNode({
            tagId,
            kind: 'SERVICE',
            name: node.name,
            env,
            labels: { source: 'skywalking', swType: node.type ?? '' },
            health: HEALTH.HEALTHY,
            lastSeen: new Date().toISOString()
          })
        );
      }

      const edges = [];

      for (const call of topology.calls ?? []) {
        const fromTag = tagBySkyWalkingId.get(call.source);
        const toTag = tagBySkyWalkingId.get(call.target);

        if (!fromTag || !toTag || fromTag === toTag) continue;

        edges.push(createEdge({ fromTag, toTag, kind: 'CALL', env }));
      }

      return { nodes, edges };
    },

    /**
     * 实例（Pod）级节点，挂到对应 SERVICE 下。
     * 先按服务名取 serviceId，再查实例列表。
     */
    async collectInstances() {
      const data = await request(
        `query Services($duration: Duration!) {
           services: queryServices(duration: $duration) { id name }
         }`,
        { duration: formatDuration(windowMinutes) }
      );

      const services = data?.services ?? [];
      const nodes = [];

      for (const service of services) {
        try {
          const instanceData = await request(
            `query Instances($serviceId: ID!, $duration: Duration!) {
               instances: queryServiceInstances(serviceId: $serviceId, duration: $duration) {
                 id name language
               }
             }`,
            { serviceId: service.id, duration: formatDuration(windowMinutes) }
          );

          const parentTag = serviceTagId(service.name);

          for (const instance of instanceData?.instances ?? []) {
            nodes.push(
              createNode({
                tagId: instanceTagId(service.name, instance.name),
                kind: 'INSTANCE',
                name: instance.name,
                env,
                parentTagId: parentTag,
                labels: {
                  source: 'skywalking',
                  language: instance.language ?? ''
                },
                health: HEALTH.HEALTHY,
                lastSeen: new Date().toISOString()
              })
            );
          }
        } catch {
          // 单个服务实例查询失败不影响整体
        }
      }

      return { nodes, edges: [] };
    },

    /** Trace 明细，Span 的 targetTagId 用 serviceCode 映射到 svc.<name> */
    async collectTrace(traceId) {
      const data = await request(
        `query Trace($traceId: ID!) {
           trace: queryTrace(traceId: $traceId) {
             spans {
               spanId parentSpanId segmentId
               serviceCode serviceInstanceId
               startTime endTime endpointName isError
               tags { key value }
             }
           }
         }`,
        { traceId }
      );

      const spans = data?.trace?.spans;

      if (!spans?.length) return null;

      const baseTime = Math.min(...spans.map((span) => Number(span.startTime)));

      const canonical = spans
        .map((span) => {
          const start = Number(span.startTime);
          const end = Number(span.endTime);

          return {
            spanId: String(span.spanId),
            parentSpanId:
              span.parentSpanId === undefined || span.parentSpanId === null
                ? undefined
                : String(span.parentSpanId),
            targetTagId: serviceTagId(span.serviceCode ?? 'unknown'),
            serviceName: span.serviceCode ?? 'unknown',
            operation: span.endpointName ?? '',
            startMs: start - baseTime,
            durationMs: Math.max(0, end - start),
            outcome: span.isError ? 'ERROR' : 'OK',
            attrs: Object.fromEntries(
              (span.tags ?? []).map((tag) => [tag.key, tag.value])
            )
          };
        })
        .sort((a, b) => a.startMs - b.startMs);

      // 链路即图上的路径，供前端直接高亮
      const path = [];

      for (const span of canonical) {
        const last = path[path.length - 1];

        if (!last || last.nodeId !== span.targetTagId) {
          path.push({
            nodeId: span.targetTagId,
            spanId: span.spanId
          });
        }
      }

      return {
        traceId,
        startedAt: new Date(baseTime).toISOString(),
        totalDurationMs:
          Math.max(...canonical.map((span) => span.startMs + span.durationMs)) ?? 0,
        spans: canonical,
        path
      };
    }
  };
};
