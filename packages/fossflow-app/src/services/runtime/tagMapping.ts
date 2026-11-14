/**
 * 图节点 ↔ 后端 tag_id 的映射规则。
 * 必须与后端 model.js 的 normalizeName / serviceTagId 保持一致。
 */

export const normalizeServiceName = (value = '') => {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
};

type ItemLike = { id: string; name?: string; tag?: string };

/** 编辑器留下的占位名，不能用来生成 tag_id，否则多个节点会撞成同一个 */
const PLACEHOLDER_NAMES = new Set(['', '未命名', 'untitled', 'undefined', 'null']);

const isPlaceholder = (value = '') => {
  const trimmed = value.trim().toLowerCase();

  return (
    PLACEHOLDER_NAMES.has(trimmed) || /^(节点|node)[\s_-]*\d*$/.test(trimmed)
  );
};

/**
 * 节点 → tag_id。
 * 优先使用节点自带的 tag（约定存放服务名或完整 tag_id）；
 * 否则用 name；name 是占位名时退回 id，避免多个节点合并到同一个 tag。
 */
export const toTagId = (item: ItemLike) => {
  const tag = (item.tag ?? '').trim();

  if (tag) return tag.startsWith('svc.') ? tag : `svc.${normalizeServiceName(tag)}`;

  const name = (item.name ?? '').trim();

  if (name && !isPlaceholder(name)) {
    return `svc.${normalizeServiceName(name)}`;
  }

  // 占位名：用 id 派生，保证唯一且稳定
  return `svc.${normalizeServiceName(item.id) || 'unknown'}`;
};

export const buildTagMapping = (items: ItemLike[]) => {
  const itemIdByTag = new Map<string, string>();
  const tagByItemId = new Map<string, string>();

  items.forEach((item) => {
    const tagId = toTagId(item);

    itemIdByTag.set(tagId, item.id);
    tagByItemId.set(item.id, tagId);
  });

  return { itemIdByTag, tagByItemId };
};
