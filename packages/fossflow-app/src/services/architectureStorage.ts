import type { DiagramData } from '../diagramUtils';

export const ARCHITECTURES_PATH = '/api/observability/architectures';

/** 列表接口返回的摘要，不含整份 diagram */
export interface ArchitectureSummary {
  id: string;
  title: string;
  updatedAt?: string;
}

/** 按 ID 读取或保存成功后返回的完整记录 */
export interface ArchitectureRecord extends ArchitectureSummary {
  diagram: DiagramData;
  createdAt?: string;
}

export interface ArchitectureStorageClient {
  create(title: string, diagram: DiagramData): Promise<ArchitectureRecord>;
  update(id: string, title: string, diagram: DiagramData): Promise<ArchitectureRecord>;
  /** 有 id 走更新，没有则新建；编辑器的保存入口统一走这里 */
  save(
    id: string | null | undefined,
    title: string,
    diagram: DiagramData
  ): Promise<ArchitectureRecord>;
  list(): Promise<ArchitectureSummary[]>;
  load(id: string): Promise<ArchitectureRecord>;
}

interface ClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : null;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

/**
 * 后台架构客户端。
 *
 * 只认本应用后端的业务路径，不直连任何基础设施；错误信息带 HTTP 状态码，
 * 便于界面把「保存失败」显示出来，而不是静默丢修改。
 */
export const createArchitectureStorageClient = (
  options: ClientOptions = {}
): ArchitectureStorageClient => {
  const baseUrl = (options.baseUrl ?? '').replace(/\/+$/, '');
  const doFetch = options.fetchImpl ?? fetch;

  const request = async (
    path: string,
    init?: RequestInit
  ): Promise<unknown> => {
    const url = `${baseUrl}${path}`;

    let response: Response;

    try {
      response = await doFetch(url, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...(init?.headers ?? {})
        }
      });
    } catch {
      throw new Error(`无法连接后台架构服务（${path}）`);
    }

    let payload: unknown = null;

    try {
      payload = await response.json();
    } catch {
      // 后端异常时可能返回空响应体，下面按状态码报错
    }

    if (!response.ok) {
      const error = asRecord(asRecord(payload)?.error);
      const message = asString(error?.message);

      throw new Error(
        message
          ? `后台架构服务返回 ${response.status}：${message}`
          : `后台架构服务返回 ${response.status}（${path}）`
      );
    }

    return asRecord(payload)?.data ?? payload;
  };

  const toRecord = (raw: unknown): ArchitectureRecord => {
    const data = asRecord(raw);

    if (!data || !asString(data.id)) {
      throw new Error('后台架构响应缺少 id');
    }

    const diagram = asRecord(data.diagram);

    if (!diagram) {
      throw new Error('后台架构响应缺少 diagram');
    }

    return {
      id: asString(data.id),
      title: asString(data.title),
      diagram: diagram as unknown as DiagramData,
      createdAt: asString(data.createdAt) || undefined,
      updatedAt: asString(data.updatedAt) || undefined
    };
  };

  const save = async (
    id: string | null | undefined,
    title: string,
    diagram: DiagramData
  ): Promise<ArchitectureRecord> => {
    const body = JSON.stringify({ title, diagram });
    const target = id
      ? `${ARCHITECTURES_PATH}/${encodeURIComponent(id)}`
      : ARCHITECTURES_PATH;

    return toRecord(
      await request(target, { method: id ? 'PUT' : 'POST', body })
    );
  };

  return {
    save,
    create: (title, diagram) => save(null, title, diagram),
    update: (id, title, diagram) => save(id, title, diagram),
    list: async () => {
      const raw = await request(ARCHITECTURES_PATH);

      if (!Array.isArray(raw)) throw new Error('后台架构列表不是数组');

      return raw
        .map((item) => {
          const data = asRecord(item) ?? {};

          return {
            id: asString(data.id),
            title: asString(data.title),
            updatedAt: asString(data.updatedAt) || undefined
          };
        })
        // 缺 id 的条目无法加载，直接丢弃而不是渲染出不可点击的行
        .filter((item) => item.id.length > 0);
    },
    load: async (id) => {
      const raw = await request(
        `${ARCHITECTURES_PATH}/${encodeURIComponent(id)}`
      );

      return toRecord(raw);
    }
  };
};

/** 页面默认使用的客户端；测试可注入假 fetch */
export const architectureStorage = createArchitectureStorageClient();
