/**
 * 业务流量模拟客户端。
 *
 * 直接打靶场业务接口（默认同源 /business/calc/add），拿到真实响应与
 * 网关写入的 traceid，供运行视图的「流量模拟」面板使用。
 *
 * 零依赖：只用浏览器自带的 fetch / AbortController / performance。
 */

export interface TrafficCall {
  id: string;
  at: string;
  a: number;
  b: number;
  status: number;
  durationMs: number;
  traceId: string | null;
  body: string;
  ok: boolean;
}

export interface TrafficOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

const API_PATH = '/business/calc/add';

const DEFAULT_TIMEOUT_MS = 10000;

const createId = (): string => {
  // crypto.randomUUID 只在安全上下文（https / localhost）可用，
  // 内网 http://192.168.10.12:8090 访问时它是 undefined，必须兜底。
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeBase = (baseUrl: string): string => baseUrl.replace(/\/+$/, '');

/**
 * 取 traceid。
 *
 * 网关 TraceIdGatewayFilter 用全小写 `traceid` 写响应头，同时下游还会透传
 * 一个 `X-Trace-Id`；实测两者可能不一致：网关那个可能是随机 UUID（32 位纯 hex），
 * 而 SkyWalking 的真 traceId 形如 <hex>.<segment>.<nanos>，带点号分段。
 * 因此有点号的那个优先。
 */
const pickTraceId = (headers: Headers): string | null => {
  const primary = (headers.get('traceid') || '').trim();
  const fallback = (headers.get('X-Trace-Id') || '').trim();

  if (!primary) return fallback || null;
  if (!fallback || fallback === primary) return primary;
  if (primary.indexOf('.') < 0 && fallback.indexOf('.') >= 0) return fallback;

  return primary;
};

/** 发起一次真实业务请求。网络错误与超时也会 resolve，用 status=0 / ok=false 表达。 */
export const fireTrafficCall = async (
  opts: TrafficOptions & { a?: number; b?: number }
): Promise<TrafficCall> => {
  const { baseUrl = '', timeoutMs = DEFAULT_TIMEOUT_MS, a = 7, b = 35 } = opts;

  const url = `${normalizeBase(baseUrl)}${API_PATH}?a=${encodeURIComponent(
    String(a)
  )}&b=${encodeURIComponent(String(b))}&_t=${Date.now()}`;

  const started = {
    id: createId(),
    at: new Date().toISOString(),
    a,
    b
  };

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));

  const t0 = performance.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });

    const durationMs = performance.now() - t0;
    const body = await response.text();

    return {
      ...started,
      status: response.status,
      durationMs,
      traceId: pickTraceId(response.headers),
      body,
      ok: response.ok
    };
  } catch (error) {
    const durationMs = performance.now() - t0;
    const reason = timedOut
      ? `请求超时（${Math.round(timeoutMs)} ms）`
      : `网络错误：${error instanceof Error ? error.message : String(error)}`;

    return {
      ...started,
      status: 0,
      durationMs,
      traceId: null,
      body: reason,
      ok: false
    };
  } finally {
    clearTimeout(timer);
  }
};

/** 按 QPS 循环压测，累计到 total 后自动停止并回调 onDone。返回的函数可立即中断。 */
export const startLoadLoop = (
  opts: TrafficOptions & {
    qps: number;
    total: number;
    /** 每次请求的加数，默认沿用 fireTrafficCall 的默认值 */
    a?: number;
    b?: number;
    onResult: (call: TrafficCall) => void;
    onDone?: () => void;
  }
): (() => void) => {
  const { qps, total, onResult, onDone, baseUrl, timeoutMs, a, b } = opts;

  const intervalMs = Math.max(1, Math.round(1000 / Math.max(0.001, qps)));
  const planned = Math.max(1, Math.floor(total));

  let fired = 0;
  let pending = 0;
  let cancelled = false;
  let finished = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const settle = () => {
    pending -= 1;

    if (!finished && !cancelled && fired >= planned && pending === 0) {
      finished = true;
      clearTimer();
      onDone?.();
    }
  };

  timer = setInterval(() => {
    if (cancelled || finished || fired >= planned) return;

    fired += 1;
    pending += 1;

    if (fired >= planned) clearTimer();

    fireTrafficCall({ baseUrl, timeoutMs, a, b }).then((call) => {
      // 用户点了「停止」但这条已经发出去了，它确实产生过流量，照样回传。
      onResult(call);
      settle();
    });
  }, intervalMs);

  return () => {
    cancelled = true;
    clearTimer();
  };
};
