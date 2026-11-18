import { createArchitectureStorageClient } from '../../architectureStorage';
import type { DiagramData } from '../../../diagramUtils';

const DIAGRAM = {
  title: 'MSC',
  icons: [],
  colors: [],
  items: [{ id: 'svc.msc-gateway', name: 'msc-gateway', icon: 'router' }],
  views: [{ id: 'v1', name: '主视图', items: [], connectors: [] }],
  fitToView: true
} as unknown as DiagramData;

const response = (status: number, payload: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  }) as Response;

/** 记录 fetch 调用的假实现，按顺序回放响应 */
const stubFetch = (responses: Response[]) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const impl = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });

    const next = responses.shift();

    if (!next) throw new Error('unexpected fetch call');

    return next;
  });

  return { impl: impl as unknown as typeof fetch, calls };
};

describe('architectureStorage client', () => {
  it('没有 id 时 POST 新建，并返回服务器生成的 id', async () => {
    const { impl, calls } = stubFetch([
      response(201, { data: { id: 'arch-1', title: 'MSC', diagram: DIAGRAM } })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    const saved = await client.save(undefined, 'MSC', DIAGRAM);

    expect(saved.id).toBe('arch-1');
    expect(calls[0].url).toBe('/api/observability/architectures');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      title: 'MSC',
      diagram: DIAGRAM
    });
  });

  it('已有 id 时 PUT 覆盖同一架构', async () => {
    const { impl, calls } = stubFetch([
      response(200, { data: { id: 'arch-1', title: 'MSC v2', diagram: DIAGRAM } })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    const saved = await client.save('arch-1', 'MSC v2', DIAGRAM);

    expect(saved.id).toBe('arch-1');
    expect(calls[0].url).toBe('/api/observability/architectures/arch-1');
    expect(calls[0].init?.method).toBe('PUT');
  });

  it('按 id 读取返回完整 diagram', async () => {
    const { impl, calls } = stubFetch([
      response(200, {
        data: { id: 'arch-1', title: 'MSC', diagram: DIAGRAM, updatedAt: '2026-11-14T12:00:00Z' }
      })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    const loaded = await client.load('arch-1');

    expect(loaded.id).toBe('arch-1');
    expect(loaded.diagram).toEqual(DIAGRAM);
    expect(loaded.updatedAt).toBe('2026-11-14T12:00:00Z');
    expect(calls[0].url).toBe('/api/observability/architectures/arch-1');
    expect(calls[0].init?.method).toBeUndefined();
  });

  it('列表只保留下拉需要的摘要字段', async () => {
    const { impl } = stubFetch([
      response(200, {
        data: [
          { id: 'arch-1', title: 'MSC', updatedAt: '2026-11-14T12:00:00Z', diagram: {} },
          { id: 'arch-2', title: '其它' }
        ]
      })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    const list = await client.list();

    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: 'arch-1',
      title: 'MSC',
      updatedAt: '2026-11-14T12:00:00Z'
    });
    expect(list[1]).toEqual({ id: 'arch-2', title: '其它', updatedAt: undefined });
  });

  it('后端返回错误时抛出带状态码的可读错误，避免静默失败', async () => {
    const { impl } = stubFetch([
      response(400, {
        error: { code: 'INVALID_ARGUMENT', message: 'title is required' }
      })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    await expect(client.save(null, '', DIAGRAM)).rejects.toThrow(
      '后台架构服务返回 400：title is required'
    );
  });

  it('列表丢弃缺少 id 的条目，避免渲染不可点击的行', async () => {
    const { impl } = stubFetch([
      response(200, {
        data: [
          { id: 'arch-1', title: 'MSC' },
          { title: 'no id' },
          { id: '', title: 'blank id' }
        ]
      })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    const list = await client.list();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('arch-1');
  });

  it('响应缺少 diagram 时报错，不把空对象当成合法架构', async () => {
    const { impl } = stubFetch([
      response(200, { data: { id: 'arch-1', title: 'MSC' } })
    ]);
    const client = createArchitectureStorageClient({ fetchImpl: impl });

    await expect(client.load('arch-1')).rejects.toThrow('缺少 diagram');
  });

  it('连接失败时抛出可读错误', async () => {
    const impl = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const client = createArchitectureStorageClient({ fetchImpl: impl });

    await expect(client.list()).rejects.toThrow('无法连接后台架构服务');
  });

  it('baseUrl 末尾斜杠会被归一化', async () => {
    const { impl, calls } = stubFetch([response(200, { data: [] })]);
    const client = createArchitectureStorageClient({
      baseUrl: 'http://127.0.0.1:3001/',
      fetchImpl: impl
    });

    await client.list();

    expect(calls[0].url).toBe('http://127.0.0.1:3001/api/observability/architectures');
  });
});
