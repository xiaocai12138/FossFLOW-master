import type { NodeKind } from './types';

/**
 * 兜底图标。
 *
 * 画布加载时会校验「item.icon 必须存在于 model.icons」，图标包还没加载完时
 * 直接引用一条不存在的 id 会让整张图校验失败、画布空白。这里给每种节点类型
 * 准备一枚内联 SVG，只在图标包确实没提供对应 id 时才补进去。
 */
const svgIcon = (fill: string, stroke: string): string => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">',
    `<rect x="8" y="14" width="48" height="36" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`,
    '<path d="M8 26h48" stroke="' + stroke + '" stroke-width="2.5" opacity="0.55"/>',
    '</svg>'
  ].join('');

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const COLORS_BY_KIND: Record<NodeKind, [string, string]> = {
  GATEWAY: ['#dbeafe', '#2563eb'],
  SERVICE: ['#e0f2fe', '#0284c7'],
  DATABASE: ['#dcfce7', '#16a34a'],
  CACHE: ['#fef3c7', '#d97706'],
  MQ: ['#ede9fe', '#7c3aed'],
  EXTERNAL: ['#f1f5f9', '#64748b'],
  INSTANCE: ['#f8fafc', '#94a3b8']
};

export interface FallbackIcon {
  id: string;
  name: string;
  url: string;
  collection: string;
  isIsometric: boolean;
}

const byIconId = new Map<string, FallbackIcon>();

/**
 * 图标 id → 兜底图标定义。同一个 id 可能对应多个 kind（例如 cube），
 * 按 id 复用，避免 model.icons 里出现重复 id。
 */
export const fallbackIconFor = (
  iconId: string,
  kind: NodeKind
): FallbackIcon => {
  const cached = byIconId.get(iconId);

  if (cached) return cached;

  const [fill, stroke] = COLORS_BY_KIND[kind] ?? COLORS_BY_KIND.SERVICE;
  const icon: FallbackIcon = {
    id: iconId,
    name: iconId,
    url: svgIcon(fill, stroke),
    collection: 'topology',
    isIsometric: false
  };

  byIconId.set(iconId, icon);

  return icon;
};

export default fallbackIconFor;
