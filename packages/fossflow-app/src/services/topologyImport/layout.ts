import type { RegistryEdge, RegistryNode } from './types';

export interface LayoutOptions {
  columnStep?: number;
  rowStep?: number;
  startY?: number;
}

export interface NodePosition {
  x: number;
  y: number;
}

const DEFAULT_COLUMN_STEP = 6;
const DEFAULT_ROW_STEP = 6;
const DEFAULT_START_Y = 6;
const GRID_COLUMNS = 3;

const toPositive = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) && (value as number) > 0 ? (value as number) : fallback;

/**
 * 给节点排位置。
 *
 * 有连线时按最长路径分层（DAG 的经典做法：层号 = 所有前驱层号 + 1 的最大值），
 * 同层节点纵向排开；没有连线时退化成 3 列网格，保证空图也有可读的排布。
 */
export const layoutNodes = (
  nodes: RegistryNode[],
  edges: RegistryEdge[],
  opts: LayoutOptions = {}
): Map<string, NodePosition> => {
  const columnStep = toPositive(opts.columnStep, DEFAULT_COLUMN_STEP);
  const rowStep = toPositive(opts.rowStep, DEFAULT_ROW_STEP);
  const startY = Number.isFinite(opts.startY)
    ? (opts.startY as number)
    : DEFAULT_START_Y;

  const positions = new Map<string, NodePosition>();
  const order = new Map<string, number>();

  nodes.forEach((node, index) => order.set(node.tagId, index));

  if (nodes.length === 0) return positions;

  const knownTagIds = new Set(nodes.map((node) => node.tagId));

  const usableEdges = edges.filter(
    (edge) =>
      edge.from !== edge.to &&
      knownTagIds.has(edge.from) &&
      knownTagIds.has(edge.to)
  );

  if (usableEdges.length === 0) {
    // 无连线：按清单原顺序 3 列网格
    nodes.forEach((node, index) => {
      positions.set(node.tagId, {
        x: (index % GRID_COLUMNS) * columnStep,
        y: startY + Math.floor(index / GRID_COLUMNS) * rowStep
      });
    });

    return positions;
  }

  const depths = new Map<string, number>();

  // 去重，否则重复边会让入度减两次，节点永远进不了队列
  const successors = new Map<string, Set<string>>();
  let indegree = new Map<string, number>();

  nodes.forEach((node) => {
    successors.set(node.tagId, new Set());
    indegree.set(node.tagId, 0);
  });

  usableEdges.forEach((edge) => {
    const out = successors.get(edge.from);

    if (!out || out.has(edge.to)) return;

    out.add(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  });

  const queue: string[] = [];

  indegree.forEach((count, tagId) => {
    if (count === 0) {
      depths.set(tagId, 0);
      queue.push(tagId);
    }
  });

  // Kahn 拓扑推进；队列空时仍未被赋值的节点都在环上
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor];
    const currentDepth = depths.get(current) ?? 0;

    cursor += 1;

    successors.get(current)?.forEach((next) => {
      const candidate = currentDepth + 1;

      if (candidate > (depths.get(next) ?? -1)) depths.set(next, candidate);

      const remaining = (indegree.get(next) ?? 0) - 1;

      indegree.set(next, remaining);

      if (remaining === 0) queue.push(next);
    });
  }

  const unresolved = nodes
    .map((node) => node.tagId)
    .filter((tagId) => !depths.has(tagId));

  if (unresolved.length > 0) {
    // 环上的节点拿不到拓扑序：统一放到已算出的最深层的下一层，
    // 既不会死循环，也不会把环和正常节点混在同一列。
    let maxResolved = -1;

    depths.forEach((depth) => {
      if (depth > maxResolved) maxResolved = depth;
    });

    const cycleDepth = maxResolved + 1;

    unresolved.forEach((tagId) => depths.set(tagId, Math.max(0, cycleDepth)));
  }

  const layerCounters = new Map<number, number>();

  [...nodes]
    .sort((a, b) => (order.get(a.tagId) ?? 0) - (order.get(b.tagId) ?? 0))
    .forEach((node) => {
      const depth = depths.get(node.tagId) ?? 0;
      const indexInLayer = layerCounters.get(depth) ?? 0;

      layerCounters.set(depth, indexInLayer + 1);

      positions.set(node.tagId, {
        x: depth * columnStep,
        y: startY + indexInLayer * rowStep
      });
    });

  return positions;
};

export default layoutNodes;
