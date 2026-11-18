import type {
  Health,
  NodeKind,
  RegistryCatalog,
  RegistryEdge,
  RegistryInstance,
  RegistryNode
} from './types';

const NODE_KINDS: NodeKind[] = [
  'SERVICE',
  'INSTANCE',
  'DATABASE',
  'CACHE',
  'MQ',
  'GATEWAY',
  'EXTERNAL'
];

const HEALTHS: Health[] = [
  'HEALTHY',
  'WARNING',
  'CRITICAL',
  'OFFLINE',
  'UNKNOWN'
];

const asString = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);

  return '';
};

const asKind = (value: unknown): NodeKind => {
  const raw = asString(value).toUpperCase();

  return NODE_KINDS.includes(raw as NodeKind) ? (raw as NodeKind) : 'SERVICE';
};

const asHealth = (value: unknown): Health => {
  const raw = asString(value).toUpperCase();

  return HEALTHS.includes(raw as Health) ? (raw as Health) : 'UNKNOWN';
};

const asLabels = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const labels: Record<string, string> = {};

  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    const text = asString(raw);

    if (text) labels[key] = text;
  });

  return Object.keys(labels).length > 0 ? labels : undefined;
};

const asInstances = (value: unknown): RegistryInstance[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const instances = value
    .map((raw): RegistryInstance | null => {
      if (!raw || typeof raw !== 'object') return null;

      const record = raw as Record<string, unknown>;
      const id = asString(record.id);

      if (!id) return null;

      const weight = Number(record.weight);
      const instance: RegistryInstance = {
        id,
        health: asString(record.health) || 'UNKNOWN'
      };

      if (Number.isFinite(weight)) instance.weight = weight;

      return instance;
    })
    .filter((instance): instance is RegistryInstance => instance !== null);

  return instances.length > 0 ? instances : undefined;
};

const normalizeNode = (raw: unknown): RegistryNode | null => {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const tagId = asString(record.tagId);
  const name = asString(record.name);

  if (!tagId || !name) return null;

  const node: RegistryNode = {
    tagId,
    kind: asKind(record.kind),
    name: name.slice(0, 100),
    health: asHealth(record.health)
  };

  const labels = asLabels(record.labels);

  if (labels) node.labels = labels;

  const instances = asInstances(record.instances);

  if (instances) node.instances = instances;

  return node;
};

const normalizeEdges = (
  raw: unknown,
  knownTagIds: Set<string>,
  warnings: string[]
): RegistryEdge[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry): RegistryEdge | null => {
      if (!entry || typeof entry !== 'object') {
        warnings.push('丢弃一条结构非法的连线');
        return null;
      }

      const record = entry as Record<string, unknown>;
      const from = asString(record.from);
      const to = asString(record.to);

      if (!from || !to) {
        warnings.push('丢弃一条缺少端点的连线');
        return null;
      }

      const missing = [from, to].filter((tagId) => !knownTagIds.has(tagId));

      if (missing.length > 0) {
        warnings.push(
          `丢弃连线 ${from} -> ${to}（端点不存在：${missing.join(', ')}）`
        );

        return null;
      }

      if (from === to) {
        warnings.push(`丢弃自环连线 ${from}`);
        return null;
      }

      const edge: RegistryEdge = { from, to };
      const kind = asString(record.kind);

      if (kind) edge.kind = kind;

      return edge;
    })
    .filter((edge): edge is RegistryEdge => edge !== null);
};

/**
 * 把后端下发的原始响应整理成严格的 `RegistryCatalog`。
 *
 * 只做字段校验与兜底，不识别来源：这里出现的任何字面量都只描述结构，
 * 一旦某项无法解析就抛出只说结构问题的错误，便于 UI 原样展示。
 */
export const normalizeCatalog = (raw: unknown): RegistryCatalog => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('响应结构不符：期望一个包含 nodes 的对象');
  }

  const record = raw as Record<string, unknown>;

  // 允许后端把契约包在 data 里下发
  const payload =
    !Array.isArray(record.nodes) &&
    record.data &&
    typeof record.data === 'object' &&
    !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : record;

  if (!Array.isArray(payload.nodes)) {
    throw new Error('响应结构不符：nodes 必须是数组');
  }

  const warnings: string[] = [];
  const nodes: RegistryNode[] = [];
  const seenTagIds = new Set<string>();

  payload.nodes.forEach((entry, index) => {
    const node = normalizeNode(entry);

    if (!node) {
      warnings.push(`丢弃第 ${index + 1} 个节点（缺少 tagId 或 name）`);
      return;
    }

    if (seenTagIds.has(node.tagId)) {
      warnings.push(`丢弃重复节点 ${node.tagId}`);
      return;
    }

    seenTagIds.add(node.tagId);
    nodes.push(node);
  });

  if (nodes.length === 0) {
    // 空清单是合法状态（例如目标环境确实没有注册项），交给 UI 显示 0 个节点。
    warnings.push('清单中没有可用的节点');
  }

  const incomingWarnings = Array.isArray(payload.warnings)
    ? payload.warnings.map(asString).filter(Boolean)
    : [];

  const edges = normalizeEdges(payload.edges, seenTagIds, warnings);

  const catalog: RegistryCatalog = {
    nodes,
    edges,
    warnings: [...incomingWarnings, ...warnings]
  };

  const source = asString(payload.source);
  const fetchedAt = asString(payload.fetchedAt);

  if (source) catalog.source = source;
  if (fetchedAt) catalog.fetchedAt = fetchedAt;

  return catalog;
};

export default normalizeCatalog;
