/**
 * Canonical Model —— 后端唯一的领域模型。
 * 任何采集器（SkyWalking / Prometheus / 自研）都必须翻译成这里的结构，
 * 不允许上游字段（serviceCode、pod、PromQL）泄漏到对外接口。
 */

export const NODE_KINDS = [
  'SERVICE',
  'INSTANCE',
  'DATABASE',
  'CACHE',
  'MQ',
  'GATEWAY',
  'EXTERNAL'
];

export const EDGE_KINDS = ['CALL', 'ASYNC', 'DATA'];

export const HEALTH = {
  HEALTHY: 'HEALTHY',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN'
};

/** 健康度严重程度，用于多来源合并时取最差值 */
const HEALTH_SEVERITY = {
  HEALTHY: 0,
  UNKNOWN: 1,
  WARNING: 2,
  CRITICAL: 3,
  OFFLINE: 4
};

export const worseHealth = (a, b) => {
  const left = HEALTH_SEVERITY[a] ?? 0;
  const right = HEALTH_SEVERITY[b] ?? 0;

  return right > left ? b : a;
};

/** 名称归一化：小写、空白转连字符，保证 tag_id 稳定且 URL 安全 */
export const normalizeName = (value = '') => {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
};

/** 服务级 tag_id：svc.<name> */
export const serviceTagId = (name) => `svc.${normalizeName(name) || 'unknown'}`;

/** 实例级 tag_id：inst.<service>.<instance> */
export const instanceTagId = (serviceName, instance) => {
  return `inst.${normalizeName(serviceName) || 'unknown'}.${
    normalizeName(instance) || 'unknown'
  }`;
};

export const createNode = ({
  tagId,
  kind,
  name,
  env = 'prod',
  parentTagId = null,
  labels = {},
  health = HEALTH.UNKNOWN,
  lastSeen = null
}) => {
  return {
    tagId,
    kind,
    name,
    env,
    parentTagId,
    labels,
    health,
    lastSeen
  };
};

export const createEdge = ({
  fromTag,
  toTag,
  kind = 'CALL',
  env = 'prod',
  callsPerMin = null,
  errorRate = null,
  p95Ms = null
}) => {
  return { fromTag, toTag, kind, env, callsPerMin, errorRate, p95Ms };
};

/**
 * 对外图结构。这是 API 与前端唯一认可的形态。
 */
export const toGraph = ({ nodes, edges, version, env }) => {
  return {
    version,
    env,
    updatedAt: Date.now(),
    nodes: nodes.map((node) => ({
      id: node.tagId,
      kind: node.kind,
      name: node.name,
      parentId: node.parentTagId,
      labels: node.labels ?? {},
      health: node.health,
      lastSeen: node.lastSeen
    })),
    edges: edges.map((edge) => ({
      id: `edge:${edge.fromTag}->${edge.toTag}:${edge.kind}`,
      from: edge.fromTag,
      to: edge.toTag,
      kind: edge.kind,
      stats: {
        callsPerMin: edge.callsPerMin,
        errorRate: edge.errorRate,
        p95Ms: edge.p95Ms
      }
    }))
  };
};
