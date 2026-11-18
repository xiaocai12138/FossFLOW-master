import type { DiagramData } from '../../diagramUtils';
import { fallbackIconFor } from './fallbackIcons';
import { iconForKind } from './iconMapping';
import { knownIconFor } from './knownIcons';
import type {
  NodeKind,
  RegistryCatalog,
  RegistryEdge,
  RegistryNode
} from './types';

interface BuildOptions {
  includeInstances?: boolean;
  title?: string;
  existing?: { icons?: any[] };
}

const VIEW_ID = 'view-topology';
const VIEW_NAME = '服务拓扑';

const COLORS = [
  { id: 'topology-call', value: '#2563eb' },
  { id: 'topology-instance', value: '#94a3b8' }
];

const CALL_COLOR = 'topology-call';
const INSTANCE_COLOR = 'topology-instance';

const MAX_NAME = 100;
const MAX_DESCRIPTION = 1000;

/** tag 是运行视图的映射键，只有服务节点需要，且必须是 svc. 前缀 */
const tagFor = (node: RegistryNode): string | undefined =>
  node.tagId.startsWith('svc.') ? node.tagId : undefined;

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-') || 'node';

const describe = (node: RegistryNode): string => {
  const parts: string[] = [node.kind, node.health];

  if (node.instances?.length) parts.push(`${node.instances.length} 个实例`);

  return parts.join(' · ').slice(0, MAX_DESCRIPTION);
};

/**
 * 把规范化清单 + 布局结果翻译成画布能直接加载的 `DiagramData`。
 *
 * 关键 schema 约束（违反会导致画布空白）：
 * - items 只放 { id, name, icon, description, tag }，位置一律在 views[0].items[].tile
 * - views 不能是空数组
 * - 每条 connector 至少两个 anchor，且 ref.item 必须指向视图内条目
 * - connector.color 引用的 id 必须出现在 colors 里
 */
export const buildDiagram = (
  catalog: RegistryCatalog,
  layout: Map<string, { x: number; y: number }>,
  opts: BuildOptions = {}
): DiagramData => {
  const { includeInstances = false, existing } = opts;
  const title = (opts.title ?? '服务拓扑').slice(0, MAX_NAME);

  const items: any[] = [];
  const viewItems: any[] = [];
  const connectors: any[] = [];

  const positionOf = (tagId: string, fallbackIndex: number) =>
    layout.get(tagId) ?? {
      x: (fallbackIndex % 3) * 5,
      y: 6 + Math.floor(fallbackIndex / 3) * 4
    };

  const addItem = (
    id: string,
    name: string,
    iconId: string,
    node: RegistryNode,
    tile: { x: number; y: number },
    tag?: string
  ) => {
    const item: Record<string, unknown> = {
      id,
      name: name.slice(0, MAX_NAME),
      icon: iconId,
      description: describe(node)
    };

    if (tag) item.tag = tag;

    items.push(item);
    viewItems.push({ id, tile });
  };

  catalog.nodes.forEach((node, index) => {
    const tile = positionOf(node.tagId, index);
    const iconId = iconForKind(node.kind);

    addItem(node.tagId, node.name, iconId, node, tile, tagFor(node));

    if (!includeInstances) return;

    (node.instances ?? []).forEach((instance, instanceIndex) => {
      const instanceId = `inst.${slug(instance.id)}`;
      const instanceNode: RegistryNode = {
        tagId: instanceId,
        kind: 'INSTANCE',
        name: instance.id,
        health: 'UNKNOWN'
      };

      // 实例紧跟在父节点右侧，纵向依次排开
      addItem(
        instanceId,
        instance.id,
        iconForKind('INSTANCE'),
        instanceNode,
        { x: tile.x + 2, y: tile.y + instanceIndex * 2 }
      );

      connectors.push({
        id: `conn-inst-${connectors.length + 1}`,
        color: INSTANCE_COLOR,
        anchors: [
          { id: `anchor-${connectors.length + 1}-a`, ref: { item: node.tagId } },
          { id: `anchor-${connectors.length + 1}-b`, ref: { item: instanceId } }
        ]
      });
    });
  });

  const knownItemIds = new Set(items.map((item) => item.id));

  const addEdge = (edge: RegistryEdge) => {
    if (!knownItemIds.has(edge.from) || !knownItemIds.has(edge.to)) return;

    const id = `conn-${connectors.length + 1}`;

    connectors.push({
      id,
      color: CALL_COLOR,
      anchors: [
        { id: `${id}-a`, ref: { item: edge.from } },
        { id: `${id}-b`, ref: { item: edge.to } }
      ]
    });
  };

  catalog.edges.forEach(addEdge);

  // 图标兜底：图标包可能还没加载，缺 id 会让整张图校验失败
  const existingIcons = Array.isArray(existing?.icons) ? existing!.icons : [];
  const existingIconIds = new Set(
    existingIcons.map((icon: any) => icon?.id).filter(Boolean)
  );

  const icons: any[] = [...existingIcons];

  const ensureIcon = (iconId: string, kind: NodeKind) => {
    if (existingIconIds.has(iconId)) return;
    if (icons.some((icon: any) => icon?.id === iconId)) return;

    // 已发布的真实 SVG 优先，缺资源时才退回内联兜底图形
    icons.push(knownIconFor(iconId) ?? fallbackIconFor(iconId, kind));
  };

  catalog.nodes.forEach((node) => ensureIcon(iconForKind(node.kind), node.kind));

  if (includeInstances) ensureIcon(iconForKind('INSTANCE'), 'INSTANCE');

  return {
    title,
    icons,
    colors: COLORS,
    items,
    views: [
      {
        id: VIEW_ID,
        name: VIEW_NAME,
        items: viewItems,
        connectors,
        rectangles: [],
        textBoxes: []
      }
    ],
    // Isoflow 读取 fitToView 来把导入节点定位到当前画布视口；
    // fitToScreen 同时保留，兼容编辑器其余仍使用旧字段的调用方。
    fitToView: true,
    fitToScreen: true
  };
};

export default buildDiagram;
