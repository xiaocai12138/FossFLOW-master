/** Names the editor leaves behind when an icon is placed without a label. */
const PLACEHOLDER_NAMES = new Set(['', '未命名', 'Untitled', 'untitled', 'undefined']);

export const isPlaceholderName = (name?: string) => {
  const trimmed = (name ?? '').trim();

  return trimmed.length === 0 || PLACEHOLDER_NAMES.has(trimmed);
};

/** Human facing name used by the run view UI. */
export const resolveDisplayName = (
  item: { id?: string; name?: string },
  index: number
) => {
  const trimmed = (item.name ?? '').trim();

  return isPlaceholderName(trimmed) ? `节点 ${index + 1}` : trimmed;
};

/**
 * Machine friendly name used for synthetic operation paths and instance ids,
 * so URLs never contain placeholder characters.
 */
export const resolveServiceName = (
  item: { id?: string; name?: string },
  index: number
) => {
  const trimmed = (item.name ?? '').trim();

  return isPlaceholderName(trimmed) ? `service-${index + 1}` : trimmed;
};
