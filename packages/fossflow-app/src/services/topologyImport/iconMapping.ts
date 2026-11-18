import type { NodeKind } from './types';

/**
 * 契约里的节点类型 → 画布内置图标 id。
 *
 * 只能使用 isoflow 图标包里真实存在的 id；写了不存在的 id 会让节点
 * 渲染成空白方块，所以这里保持一张显式白名单式的映射表。
 */
const ICON_BY_KIND: Record<NodeKind, string> = {
  // APIGateway 的实际 SVG 是紫色立方体，不能只因 id 名称就当成网关图标
  GATEWAY: 'router',
  SERVICE: 'block',
  DATABASE: 'cube',
  CACHE: 'cache',
  MQ: 'queue',
  EXTERNAL: 'cloud',
  INSTANCE: 'cube'
};

export const iconForKind = (kind: NodeKind): string =>
  ICON_BY_KIND[kind] ?? 'block';

export const SUPPORTED_ICON_IDS: string[] = Array.from(
  new Set(Object.values(ICON_BY_KIND))
);

export default iconForKind;
