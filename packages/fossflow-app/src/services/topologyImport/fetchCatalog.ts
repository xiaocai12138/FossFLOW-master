import { normalizeCatalog } from './normalize';
import type { RegistryCatalog, RegistrySourceInfo } from './types';

const SOURCES_PATH = '/api/observability/registry/sources';

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const statusSuffix = (url: string, status: number): string =>
  `HTTP ${status} ${url}`;

/**
 * 请求一份规范化后的拓扑清单。
 *
 * 错误信息里带 HTTP 状态码与 URL，方便对照 nginx / 后端日志排查；
 * 但不描述具体产品，前端不该知道数据从哪个系统来。
 */
export const fetchCatalog = async (
  url: string,
  signal?: AbortSignal
): Promise<RegistryCatalog> => {
  const target = url.trim();

  if (!target) throw new Error('请先填写拓扑地址');

  let response: Response;

  try {
    response = await fetch(target, {
      signal,
      headers: { Accept: 'application/json' }
    });
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error;

    throw new Error(`无法连接 ${target}`);
  }

  if (!response.ok) {
    throw new Error(`请求失败：${statusSuffix(target, response.status)}`);
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'AbortError') throw error;

    throw new Error(`响应不是合法 JSON：${statusSuffix(target, response.status)}`);
  }

  try {
    return normalizeCatalog(payload);
  } catch (error) {
    const reason = error instanceof Error ? error.message : '结构无法识别';

    throw new Error(`${reason}（${statusSuffix(target, response.status)}）`);
  }
};

const normalizeSource = (raw: unknown): RegistrySourceInfo | null => {
  if (!raw || typeof raw !== 'object') return null;

  const record = raw as Record<string, unknown>;
  const name = asString(record.name);
  const displayName = asString(record.displayName) || name;

  if (!name || !displayName) return null;

  // 健康信息可能嵌在 health 里，也可能平铺在条目上，两种都接受
  const nested =
    record.health && typeof record.health === 'object'
      ? (record.health as Record<string, unknown>)
      : {};

  const ok = nested.ok === true || record.ok === true;
  const detail = asString(nested.detail) || asString(record.detail);

  const info: RegistrySourceInfo = {
    name,
    displayName,
    health: { ok }
  };

  if (detail) info.health.detail = detail;

  return info;
};

/**
 * 拉取可用的拓扑来源列表。
 *
 * 失败一律返回空数组而不是抛错：下拉按钮是辅助入口，
 * 拿不到列表时 UI 会降级成「使用默认地址」，不应连带阻断主流程。
 */
export const fetchSources = async (
  baseUrl = ''
): Promise<RegistrySourceInfo[]> => {
  const prefix = baseUrl.replace(/\/+$/, '');

  try {
    const response = await fetch(`${prefix}${SOURCES_PATH}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) return [];

    const payload: unknown = await response.json();
    const list = Array.isArray(payload)
      ? payload
      : payload && typeof payload === 'object'
        ? (payload as Record<string, unknown>).data ??
          (payload as Record<string, unknown>).sources
        : null;

    if (!Array.isArray(list)) return [];

    return list
      .map(normalizeSource)
      .filter((source): source is RegistrySourceInfo => source !== null);
  } catch {
    return [];
  }
};

export { SOURCES_PATH };
