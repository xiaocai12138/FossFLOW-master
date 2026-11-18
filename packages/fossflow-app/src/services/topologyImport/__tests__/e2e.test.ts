import { fetchSources, importTopology, previewImport } from '..';

/**
 * 真实 zod schema 用 require 在运行时取：静态 import 会让 app 的 tsc
 * 顺着这条边把 fossflow-lib 源码拉进类型检查（lib 用 src/* 别名，跨包引整片报错）。
 * jest 的 moduleNameMapper 已把 src/* 映射到 lib 源码目录。
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

/**
 * 端到端联调测试：真实 importTopology 打真实后端，产出再用真实 modelSchema 校验。
 *
 * 默认跳过，避免日常跑测试时依赖网络。要跑就指定后端地址：
 *   E2E_BASE_URL=http://127.0.0.1:8090 npx jest --config <cfg> --testPathPattern e2e
 */
const BASE = process.env.E2E_BASE_URL || '';
const describeE2E = BASE ? describe : describe.skip;

describeE2E('端到端：真实后端 → 真实 modelSchema', () => {
  const url = `${BASE}/api/observability/registry/services?includeInstances=true`;

  jest.setTimeout(60000);

  it('sources 解析出至少一个来源，displayName 来自后端', async () => {
    const sources = await fetchSources(BASE);

    expect(sources.length).toBeGreaterThan(0);
    sources.forEach((source) => {
      expect(source.name.length).toBeGreaterThan(0);
      expect(source.displayName.length).toBeGreaterThan(0);
    });
  });

  it('previewImport 识别到节点', async () => {
    const preview = await previewImport(url);

    expect(preview.nodes.length).toBeGreaterThan(0);
    expect(Array.isArray(preview.edges)).toBe(true);
    expect(Array.isArray(preview.warnings)).toBe(true);
  });

  it.each([false, true])(
    'importTopology(includeInstances=%s) 产出通过 modelSchema 校验',
    async (includeInstances) => {
      const { diagram } = await importTopology(url, { includeInstances });
      const parsed = modelSchema.safeParse(diagram);

      if (!parsed.success) {
        throw new Error(
          (parsed.error?.errors ?? [])
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('\n')
        );
      }

      expect(parsed.success).toBe(true);
      expect(diagram.items.length).toBeGreaterThan(0);
      expect(diagram.views).toHaveLength(1);

      // items 不能带 type / position（位置只在 views[0].items[].tile）
      diagram.items.forEach((item: any) => {
        expect(item.type).toBeUndefined();
        expect(item.position).toBeUndefined();
      });

      const view = diagram.views[0];
      const viewIds = new Set(view.items.map((viewItem: any) => viewItem.id));

      view.connectors.forEach((connector: any) => {
        expect(connector.anchors.length).toBeGreaterThanOrEqual(2);
        connector.anchors.forEach((anchor: any) => {
          expect(Object.keys(anchor.ref)).toHaveLength(1);
          expect(viewIds.has(anchor.ref.item)).toBe(true);
        });
      });

      const colorIds = new Set(diagram.colors.map((color: any) => color.id));

      view.connectors.forEach((connector: any) => {
        if (!connector.color) return;

        expect(colorIds.has(connector.color)).toBe(true);
      });

      const iconIds = new Set(diagram.icons.map((icon: any) => icon.id));

      diagram.items.forEach((item: any) => {
        expect(iconIds.has(item.icon)).toBe(true);
      });

      // tag 只在 svc. 前缀时出现
      diagram.items.forEach((item: any) => {
        if (item.tag === undefined) return;

        expect(item.tag.startsWith('svc.')).toBe(true);
      });
    }
  );
});
