/**
 * fetchCatalog / fetchSources 的契约测试。
 *
 * 响应样本来自与后端联调时抓下的真实形状（data 包装、sources 平铺 ok/detail）。
 * 用 mock fetch 驱动真实实现，避免测试自己重写一遍解析逻辑。
 */
import { fetchCatalog, fetchSources } from '../fetchCatalog';

const REAL_SOURCES_PAYLOAD = {
  data: [
    {
      name: 'example-source',
      displayName: '示例注册中心',
      ok: true,
      detail: 'readiness ok',
      isDefault: true
    }
  ]
};

const REAL_SERVICES_PAYLOAD = {
  data: {
    source: 'example-source',
    fetchedAt: '2026-11-14T08:51:32.503191362Z',
    nodes: [
      {
        tagId: 'svc.demo-service',
        kind: 'SERVICE',
        name: 'demo-service',
        health: 'HEALTHY',
        labels: { group: 'DEFAULT_GROUP', namespace: 'public' },
        instances: [
          { id: '172.21.0.8:9098', health: 'HEALTHY', weight: 1.0 },
          { id: '172.21.0.11:9098', health: 'HEALTHY', weight: 1.0 }
        ]
      },
      {
        tagId: 'svc.demo-gateway',
        kind: 'GATEWAY',
        name: 'demo-gateway',
        health: 'HEALTHY',
        instances: [{ id: '172.21.0.12:10001', health: 'HEALTHY', weight: 1.0 }]
      }
    ],
    edges: [],
    warnings: ['该来源只提供服务清单，不含调用关系']
  }
};

const jsonResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as unknown as Response;

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchCatalog', () => {
  it('把 data 包装的真实响应解包成 catalog', async () => {
    global.fetch = jest.fn(async () => jsonResponse(REAL_SERVICES_PAYLOAD)) as any;

    const catalog = await fetchCatalog('/api/observability/registry/services');

    expect(catalog.source).toBe('example-source');
    expect(catalog.nodes).toHaveLength(2);
    expect(catalog.nodes[0].instances).toHaveLength(2);
    expect(catalog.edges).toHaveLength(0);
    expect(catalog.warnings).toContain('该来源只提供服务清单，不含调用关系');
  });

  it('HTTP 失败时错误里带状态码和 URL', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ error: 'nope' }, 404)
    ) as any;

    await expect(fetchCatalog('/api/x')).rejects.toThrow(/HTTP 404/);
    await expect(fetchCatalog('/api/x')).rejects.toThrow(/\/api\/x/);
  });

  it('结构不符时错误里带状态码与 URL', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ data: { nodes: 'broken' } })
    ) as any;

    await expect(fetchCatalog('/api/y')).rejects.toThrow(/nodes 必须是数组/);
    await expect(fetchCatalog('/api/y')).rejects.toThrow(/HTTP 200/);
  });

  it('非 JSON 响应给出明确错误', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      }
    })) as any;

    await expect(fetchCatalog('/api/z')).rejects.toThrow(/不是合法 JSON/);
  });

  it('空地址直接拒绝，不发请求', async () => {
    const spy = jest.fn();

    global.fetch = spy as any;

    await expect(fetchCatalog('   ')).rejects.toThrow(/请先填写/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('取消不会伪装成普通错误', async () => {
    const abortError = Object.assign(new Error('aborted'), { name: 'AbortError' });

    global.fetch = jest.fn(async () => {
      throw abortError;
    }) as any;

    await expect(fetchCatalog('/api/w')).rejects.toThrow('aborted');
  });
});

describe('fetchSources', () => {
  it('解析真实 sources 形状（ok/detail 平铺在条目上）', async () => {
    global.fetch = jest.fn(async () => jsonResponse(REAL_SOURCES_PAYLOAD)) as any;

    const sources = await fetchSources();

    expect(sources).toEqual([
      {
        name: 'example-source',
        displayName: '示例注册中心',
        health: { ok: true, detail: 'readiness ok' }
      }
    ]);
  });

  it('兼容 health 嵌套的写法', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        sources: [
          {
            name: 'nested',
            displayName: '嵌套写法',
            health: { ok: false, detail: 'down' }
          }
        ]
      })
    ) as any;

    const sources = await fetchSources();

    expect(sources[0].health).toEqual({ ok: false, detail: 'down' });
  });

  it('请求失败返回空数组而不是抛错（下拉降级）', async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 500)) as any;

    await expect(fetchSources()).resolves.toEqual([]);
  });

  it('网络异常也返回空数组', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('network down');
    }) as any;

    await expect(fetchSources()).resolves.toEqual([]);
  });

  it('缺少 name 的条目被跳过', async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ data: [{ displayName: '无名' }, { name: 'ok', displayName: '正常' }] })
    ) as any;

    const sources = await fetchSources();

    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('ok');
  });

  it('baseUrl 会拼在路径前面', async () => {
    const spy = jest.fn(async () => jsonResponse({ data: [] }));

    global.fetch = spy as any;
    await fetchSources('http://host:1234/');

    const requested = (spy.mock.calls[0] as unknown[])[0];

    expect(requested).toBe('http://host:1234/api/observability/registry/sources');
  });
});
