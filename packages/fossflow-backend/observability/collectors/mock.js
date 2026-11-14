import { HEALTH, createEdge, createNode, serviceTagId } from '../model.js';

/**
 * Mock 采集器：在没有 SkyWalking / Prometheus 的环境中，
 * 按同一套 Canonical Model 产出确定性的假数据。
 *
 * 目的：让前端先按真实接口契约对接，后续换成真实采集器时前端零改动。
 */

const hash = (value = '') => {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
};

const seeded = (seed, min, max) => {
  const ratio = (Math.abs(seed) % 1000) / 1000;

  return min + ratio * (max - min);
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

/** 演示拓扑：前端初始化架构图时可直接使用 */
const DEMO_SERVICES = [
  { name: 'api-gateway', kind: 'GATEWAY' },
  { name: 'order-service', kind: 'SERVICE' },
  { name: 'inventory-service', kind: 'SERVICE' },
  { name: 'payment-service', kind: 'SERVICE' },
  { name: 'order-db', kind: 'DATABASE' },
  { name: 'inventory-db', kind: 'DATABASE' }
];

const DEMO_EDGES = [
  ['api-gateway', 'order-service'],
  ['order-service', 'inventory-service'],
  ['order-service', 'payment-service'],
  ['order-service', 'order-db'],
  ['inventory-service', 'inventory-db']
];

/** 调用链固定沿这条路径走，便于前端验证高亮 */
const DEMO_CHAIN = [
  'api-gateway',
  'order-service',
  'inventory-service',
  'inventory-db'
];

const LEVELS = ['INFO', 'INFO', 'INFO', 'WARN', 'ERROR', 'DEBUG'];

const LOG_TEMPLATES = {
  INFO: [
    'handled request in {ms}ms',
    'span propagated downstream with parent context',
    'health probe succeeded'
  ],
  WARN: [
    'retry attempt 1 of 3 after upstream timeout',
    'queue depth approaching threshold: {n}'
  ],
  ERROR: ['downstream call failed with status 503', 'deadline exceeded after {ms}ms'],
  DEBUG: ['cache lookup miss for key order:{n}', 'resolved upstream via service discovery']
};

export const createMockCollector = ({ env = 'prod' } = {}) => {
  const metricsFor = (tagId) => {
    const seed = hash(tagId);
    const degraded = seed % 7 === 0;

    return {
      cpu: round(seeded(seed, 8, degraded ? 92 : 68), 1),
      memory: round(seeded(seed >>> 2, 25, degraded ? 94 : 78), 1),
      latencyP95Ms: round(seeded(seed >>> 4, 18, degraded ? 1200 : 300), 1),
      qps: Math.round(seeded(seed >>> 6, 20, 3200)),
      errorRate: round(degraded ? seeded(seed >>> 8, 3, 18) : seeded(seed >>> 8, 0, 1.2), 2),
      uptimeSeconds: Math.round(seeded(seed >>> 10, 3600, 2592000))
    };
  };

  /**
   * 生成一条确定性调用链。
   * 用闭包而非 this 调用，避免被 service 层解构后丢失上下文。
   */
  const buildTrace = (traceId, { tagIds } = {}) => {
    const seed = hash(traceId);

    /**
     * 若前端传入了图中的 tag_id，就沿这些节点生成调用链，
     * 保证 span 能匹配到图节点、链路可以正确高亮。
     * 否则退回演示链路。
     */
    const chainTags =
      tagIds?.length > 1
        ? tagIds.slice(0, 6)
        : DEMO_CHAIN.map((name) => serviceTagId(name));
    const chainNames = chainTags.map((tagId) => tagId.replace(/^svc\./, ''));
    const truncated = traceId.includes('short') ? chainTags.slice(0, 2) : chainTags;

    let cursor = 0;

    const spans = truncated.map((tagId, index) => {
      const serviceName = chainNames[index] ?? tagId;
      const spanSeed = hash(`${traceId}:${tagId}:${index}`);
      const duration = Math.round(seeded(spanSeed, 8, index === 0 ? 60 : 240));

      const span = {
        spanId: `${index + 1}`,
        parentSpanId: index === 0 ? undefined : `${index}`,
        targetTagId: tagId,
        serviceName,
        operation: `${index === 0 ? 'GET' : 'POST'} /api/${serviceName}/handle`,
        startMs: cursor,
        durationMs: duration,
        outcome: spanSeed % 11 === 0 ? 'ERROR' : 'OK'
      };

      cursor += Math.round(duration * 0.6) + 2;

      return span;
    });

    return {
      traceId,
      startedAt: new Date(Date.now() - (seed % 600) * 1000).toISOString(),
      totalDurationMs: cursor,
      entryService: spans[0]?.serviceName ?? 'unknown',
      spans,
      path: spans.map((span) => ({
        nodeId: span.targetTagId,
        spanId: span.spanId
      }))
    };
  };

  return {
    name: 'mock',
    emissions: ['GRAPH', 'METRIC', 'LOG', 'TRACE'],

    async health() {
      return { ok: true, detail: 'mock collector (no external dependency)' };
    },

    async collectGraph() {
      const nodes = DEMO_SERVICES.map((service) =>
        createNode({
          tagId: serviceTagId(service.name),
          kind: service.kind,
          name: service.name,
          env,
          labels: { source: 'mock' },
          health: HEALTH.HEALTHY,
          lastSeen: new Date().toISOString()
        })
      );

      const edges = DEMO_EDGES.map(([from, to]) => {
        const seed = hash(`${from}->${to}`);

        return createEdge({
          fromTag: serviceTagId(from),
          toTag: serviceTagId(to),
          kind: 'CALL',
          env,
          callsPerMin: Math.round(seeded(seed, 40, 900)),
          errorRate: round(seeded(seed >>> 3, 0, 2), 2),
          p95Ms: round(seeded(seed >>> 5, 20, 400), 1)
        });
      });

      return { nodes, edges };
    },

    /** 实例层：每个服务固定两个 Pod 名，便于验证下钻 */
    async collectInstances() {
      const nodes = [];

      for (const service of DEMO_SERVICES) {
        if (service.kind !== 'SERVICE') continue;

        const seed = hash(service.name);

        for (let index = 0; index < 2; index += 1) {
          const podName = `${service.name}-${(seed % 9000 + index * 17).toString(16)}`;

          nodes.push(
            createNode({
              tagId: `inst.${service.name}.${podName}`,
              kind: 'INSTANCE',
              name: podName,
              env,
              parentTagId: serviceTagId(service.name),
              labels: { source: 'mock', zone: index === 0 ? 'a' : 'b' },
              health: HEALTH.HEALTHY,
              lastSeen: new Date().toISOString()
            })
          );
        }
      }

      return { nodes, edges: [] };
    },

    async collectMetrics({ tagId, names }) {
      const all = metricsFor(tagId);
      const units = {
        cpu: '%',
        memory: '%',
        latencyP95Ms: 'ms',
        qps: 'count',
        errorRate: '%',
        uptimeSeconds: 's'
      };
      const wanted = names?.length ? names : Object.keys(all);

      return wanted
        .filter((name) => all[name] !== undefined)
        .map((name) => ({
          tagId,
          name,
          unit: units[name] ?? '',
          value: all[name]
        }));
    },

    async collectLogs({ tagId, traceId, level, limit = 40 }) {
      const seed = hash(`${tagId}:${traceId ?? 'live'}`);
      const base = Date.now() - 600_000;
      const levels = level && level !== 'ALL' ? [level] : LEVELS;

      return Array.from({ length: limit }).map((_, index) => {
        const logSeed = hash(`${tagId}:${index}:${seed}`);
        const levelValue = levels[logSeed % levels.length];
        const templates = LOG_TEMPLATES[levelValue];
        const message = templates[logSeed % templates.length]
          .replace('{ms}', String(Math.round(seeded(logSeed, 4, 480))))
          .replace('{n}', String(logSeed % 90));

        return {
          id: `${tagId}-${index}`,
          tagId,
          traceId: traceId ?? undefined,
          level: levelValue,
          timestamp: new Date(base + index * 3000).toISOString(),
          message: traceId ? `[${tagId}] ${message}` : message
        };
      });
    },

    async collectTrace(traceId, { tagIds } = {}) {
      return buildTrace(traceId, { tagIds });
    },

    async collectRecentTraces({ limit = 10, tagIds } = {}) {
      return Array.from({ length: limit }).map((_, index) =>
        buildTrace(`mock-trace-${String(index + 1).padStart(4, '0')}`, { tagIds })
      );
    }
  };
};
