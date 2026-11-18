import { buildDiagram } from '../diagramBuilder';
import { iconForKind } from '../iconMapping';
import { layoutNodes } from '../layout';
import type { RegistryCatalog } from '../types';
import { extractSavableData } from '../../../diagramUtils';

/**
 * 真正的 zod schema，用 require 在运行时取。
 *
 * 不走 `import` 是为了不让 app 的 tsc 顺着这条边把 fossflow-lib 的源码
 * 也拉进类型检查范围（lib 用 `src/*` 路径别名，跨包引会整片报错）；
 * jest 的 moduleNameMapper 已经把 `src/*` 映射到 lib 源码目录。
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { modelSchema } = require('fossflow/src/schemas/model') as {
  modelSchema: {
    safeParse: (input: unknown) => {
      success: boolean;
      error?: { errors: { path: (string | number)[]; message: string }[] };
    };
  };
};

/** 把 zod 的 issues 拼成可读文本，校验失败时直接抛出来便于定位 */
const describeIssues = (result: {
  error?: { errors: { path: (string | number)[]; message: string }[] };
}): string =>
  (result.error?.errors ?? [])
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

/** isoflow 图标包里真实存在的 id（写错会让画布渲染成空白） */
const ALLOWED_ICONS = new Set([
  'block',
  'cloud',
  'cube',
  'dns',
  'document',
  'image',
  'mobiledevice',
  'queue',
  'cache',
  'dataloader',
  'firewall',
  'loadbalancer',
  'APIGateway',
  'router',
  'laptop',
  'desktop',
  'lock',
  'mail',
  'diamond',
  'cronjob',
  'cardterminal',
  'function-module'
]);

const CATALOG: RegistryCatalog = {
  source: 'demo',
  nodes: [
    {
      tagId: 'svc.msc-gateway',
      kind: 'GATEWAY',
      name: 'msc-gateway',
      health: 'HEALTHY',
      labels: { group: 'DEFAULT_GROUP' },
      instances: [
        { id: '172.21.0.12:10001', health: 'HEALTHY', weight: 1 },
        { id: '172.21.0.13:10001', health: 'WARNING' }
      ]
    },
    {
      tagId: 'svc.msc-business-service',
      kind: 'SERVICE',
      name: 'msc-business-service',
      health: 'HEALTHY'
    },
    {
      tagId: 'db.main',
      kind: 'DATABASE',
      name: 'main-db',
      health: 'WARNING'
    }
  ],
  edges: [
    { from: 'svc.msc-gateway', to: 'svc.msc-business-service', kind: 'CALL' },
    { from: 'svc.msc-business-service', to: 'db.main', kind: 'CALL' }
  ]
};

const build = (includeInstances = false) => {
  const layout = layoutNodes(CATALOG.nodes, CATALOG.edges);

  return buildDiagram(CATALOG, layout, { includeInstances });
};

describe('buildDiagram', () => {
  /**
   * 证明 modelSchema 的断言不是空转：以下都是真的会被拒绝的写法。
   *
   * 注意两点实测结论：
   * - zod 默认 strip 未知字段，所以 item 上多写的 position 不会报错，
   *   「items 不含 position」靠下面的 Object.keys 断言保证；
   * - views: [] 本身能通过 schema（画布在 useInitialDataManager 里补一个视图），
   *   builder 仍固定产出 views[0]，避免走到那条补建分支。
   */
  it('反向校验：modelSchema 确实会拒绝若干错误写法', () => {
    const diagram = build();
    const view = diagram.views[0];

    // connector 少于 2 个 anchor → 拒绝
    expect(
      modelSchema.safeParse({
        ...diagram,
        views: [
          {
            ...view,
            connectors: [
              {
                id: 'thin',
                anchors: [{ id: 'only-one', ref: { item: view.items[0].id } }]
              }
            ]
          }
        ]
      }).success
    ).toBe(false);

    // connector.color 指向不存在的颜色 → 拒绝
    expect(
      modelSchema.safeParse({
        ...diagram,
        views: [
          {
            ...view,
            connectors: [
              { ...view.connectors[0], color: 'no-such-color' },
              view.connectors[1]
            ]
          }
        ]
      }).success
    ).toBe(false);

    // view item 指向不存在的 model item → 拒绝
    expect(
      modelSchema.safeParse({
        ...diagram,
        views: [
          {
            ...view,
            items: [...view.items, { id: 'ghost-item', tile: { x: 0, y: 0 } }]
          }
        ]
      }).success
    ).toBe(false);

    // item.name 超过 100 字符 → 拒绝
    expect(
      modelSchema.safeParse({
        ...diagram,
        items: diagram.items.map((item: any) => ({ ...item, name: 'x'.repeat(101) }))
      }).success
    ).toBe(false);
  });

  it('produces valid schema：通过真实 modelSchema 校验', () => {
    const diagram = build();
    const result = modelSchema.safeParse(diagram);

    if (!result.success) {
      throw new Error(`modelSchema 校验失败：\n${describeIssues(result)}`);
    }

    expect(result.success).toBe(true);
  });

  it('包含实例时同样通过 modelSchema 校验', () => {
    const diagram = build(true);
    const result = modelSchema.safeParse(diagram);

    if (!result.success) {
      throw new Error(`modelSchema 校验失败：\n${describeIssues(result)}`);
    }

    expect(result.success).toBe(true);
  });

  it('items 只有 id/name/icon/description/tag，没有 type 或 position', () => {
    const diagram = build();

    expect(diagram.items).toHaveLength(3);

    diagram.items.forEach((item: any) => {
      expect(Array.isArray(item)).toBe(false);
      // 关键：位置只能在 views[0].items[].tile，不能写在 item 上
      expect(item.type).toBeUndefined();
      expect(item.position).toBeUndefined();

      const allowed = new Set(['id', 'name', 'icon', 'description', 'tag']);
      Object.keys(item).forEach((key) => expect(allowed.has(key)).toBe(true));
    });
  });

  it('views[0] 存在且每个条目都带数值 tile', () => {
    const diagram = build();

    expect(Array.isArray(diagram.views)).toBe(true);
    expect(diagram.views).toHaveLength(1);

    const view = diagram.views[0];

    expect(typeof view.id).toBe('string');
    expect(typeof view.name).toBe('string');
    expect(view.items).toHaveLength(3);

    view.items.forEach((viewItem: any) => {
      expect(typeof viewItem.id).toBe('string');
      expect(typeof viewItem.tile.x).toBe('number');
      expect(typeof viewItem.tile.y).toBe('number');
    });

    const modelIds = new Set(diagram.items.map((item: any) => item.id));

    view.items.forEach((viewItem: any) => {
      expect(modelIds.has(viewItem.id)).toBe(true);
    });
  });

  it('每条 connector 至少 2 个 anchor，且 ref.item 指向视图内条目', () => {
    const diagram = build();
    const view = diagram.views[0];

    expect(view.connectors).toHaveLength(2);

    const viewItemIds = new Set(view.items.map((viewItem: any) => viewItem.id));

    view.connectors.forEach((connector: any) => {
      expect(typeof connector.id).toBe('string');
      expect(connector.anchors.length).toBeGreaterThanOrEqual(2);

      connector.anchors.forEach((anchor: any) => {
        expect(typeof anchor.id).toBe('string');
        // anchor.ref 只能引用一个目标，且必须存在
        expect(Object.keys(anchor.ref)).toHaveLength(1);
        expect(viewItemIds.has(anchor.ref.item)).toBe(true);
      });
    });
  });

  it('connector 引用的 color 一定存在于 colors', () => {
    const diagram = build();
    const colorIds = new Set(diagram.colors.map((color: any) => color.id));

    diagram.views[0].connectors.forEach((connector: any) => {
      if (!connector.color) return;

      expect(colorIds.has(connector.color)).toBe(true);
    });
  });

  it('icon 全部在允许集合内，且 items 引用的 icon 都在 icons 里', () => {
    const diagram = build(true);
    const iconIds = new Set(diagram.icons.map((icon: any) => icon.id));

    diagram.items.forEach((item: any) => {
      expect(ALLOWED_ICONS.has(item.icon)).toBe(true);
      // 引用不存在的 icon 会让整个模型校验失败、画布空白
      expect(iconIds.has(item.icon)).toBe(true);
    });

    (
      ['SERVICE', 'INSTANCE', 'DATABASE', 'CACHE', 'MQ', 'GATEWAY', 'EXTERNAL'] as const
    ).forEach((kind) => {
      expect(ALLOWED_ICONS.has(iconForKind(kind))).toBe(true);
    });
  });

  it('网关节点使用经视觉核验的 router 图标，并携带可加载的图标资源', () => {
    const diagram = build();
    const gateway = diagram.items.find(
      (item: any) => item.id === 'svc.msc-gateway'
    );

    // APIGateway 的实际资源是紫色立方体，不能因 id 名称推定它是网关图标
    expect(gateway?.icon).toBe('router');
    expect(diagram.icons.find((icon: any) => icon.id === 'router')?.url).toBe(
      '/icons-export/isoflow/router.svg'
    );
  });

  it('只有 svc. 前缀的 tagId 才写 tag', () => {
    const diagram = build();
    const byId = new Map(diagram.items.map((item: any) => [item.id, item]));

    expect((byId.get('svc.msc-gateway') as any).tag).toBe('svc.msc-gateway');
    expect((byId.get('db.main') as any).tag).toBeUndefined();
  });

  it('includeInstances 时实例成为独立节点并连到父服务', () => {
    const diagram = build(true);
    const view = diagram.views[0];

    const instanceItems = diagram.items.filter((item: any) =>
      item.id.startsWith('inst.')
    );

    expect(instanceItems).toHaveLength(2);
    expect(view.items).toHaveLength(5);
    // 2 条服务间连线 + 2 条实例连线
    expect(view.connectors).toHaveLength(4);

    const instLinks = view.connectors.filter((connector: any) =>
      connector.anchors.some((anchor: any) => anchor.ref.item.startsWith('inst.'))
    );

    expect(instLinks).toHaveLength(2);

    instLinks.forEach((connector: any) => {
      const refs = connector.anchors.map((anchor: any) => anchor.ref.item);

      expect(refs).toContain('svc.msc-gateway');
    });
  });

  it('不含实例时默认不生成实例节点', () => {
    const diagram = build();

    expect(
      diagram.items.some((item: any) => item.id.startsWith('inst.'))
    ).toBe(false);
  });

  it('fitToScreen 为 true', () => {
    expect(build().fitToScreen).toBe(true);
  });

  it('导入图会请求画布适配视口', () => {
    expect(build().fitToView).toBe(true);
  });

  it('保存后仍保留视口适配请求，刷新不会回到空画布', () => {
    const saved = extractSavableData(build());

    expect(saved.fitToView).toBe(true);
  });

  it('已有 icons 会被保留，不与兜底图标重复', () => {
    const layout = layoutNodes(CATALOG.nodes, CATALOG.edges);
    const existingIcons = [
      { id: 'block', name: 'block', url: 'x', collection: 'isoflow' }
    ];

    const diagram = buildDiagram(CATALOG, layout, {
      existing: { icons: existingIcons }
    });

    expect(diagram.icons.filter((icon: any) => icon.id === 'block')).toHaveLength(1);
  });

  it('空清单也能生成合法图（不抛错、views[0] 存在）', () => {
    const empty: RegistryCatalog = { nodes: [], edges: [] };
    const diagram = buildDiagram(empty, new Map(), {});

    expect(diagram.items).toHaveLength(0);
    expect(diagram.views).toHaveLength(1);
    expect(diagram.views[0].connectors).toHaveLength(0);
  });

  it('边引用了缺失节点时跳过该连线', () => {
    const layout = layoutNodes(CATALOG.nodes, CATALOG.edges);
    const withGhost: RegistryCatalog = {
      ...CATALOG,
      edges: [...CATALOG.edges, { from: 'svc.msc-gateway', to: 'svc.ghost' }]
    };

    const diagram = buildDiagram(withGhost, layout, {});

    expect(diagram.views[0].connectors).toHaveLength(2);
  });
});
