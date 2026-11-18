/**
 * 轮询重试工具。
 *
 * 典型场景：Loki 日志入库有 15~20 秒延迟，第一次查不到不代表没有数据，
 * 只是还没落盘。用一次请求就判定「暂无日志」会误导用户，所以需要轮询。
 *
 * 设计要点：
 * - 最后一次尝试之后不再等待，避免白白多等一个间隔；
 * - signal 触发时立刻以 AbortError reject，不吞掉取消；
 * - fetcher 抛错（网络抖动 / 5xx）视为「本次没拿到」，继续重试；
 * - 单次请求超时用独立的 TimeoutError，与外部取消区分开。
 */

export interface PollOptions {
  /** 最大尝试次数，默认 8 */
  attempts?: number;
  /** 间隔毫秒，默认 2500 */
  intervalMs?: number;
  /** 单次请求超时，默认 8000 */
  timeoutMs?: number;
  /** 每次未满足条件后的回调（用于 UI 显示「入库中 3/8」） */
  onAttempt?: (attempt: number, total: number) => void;
  /** 外部取消信号 */
  signal?: AbortSignal;
}

export interface PollResult<T> {
  /** 最后一次成功取到的值（可能是空集合） */
  value: T;
  /** 实际执行的尝试次数 */
  attempts: number;
  /** 次数用尽仍未满足 predicate */
  exhausted: boolean;
}

const DEFAULT_ATTEMPTS = 8;
const DEFAULT_INTERVAL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 8000;

const createNamedError = (name: string, message: string): Error => {
  if (typeof DOMException === 'function') {
    return new DOMException(message, name);
  }

  const error = new Error(message);

  error.name = name;

  return error;
};

/** 构造标准的 AbortError，便于上层用 isAbortError 判断 */
export const createAbortError = (message = '请求已取消'): Error =>
  createNamedError('AbortError', message);

/** 判断是否取消错误（含跨环境 name 判断） */
export const isAbortError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      (error as { name?: unknown }).name === 'AbortError'
  );

const createTimeoutError = (message = '请求超时'): Error =>
  createNamedError('TimeoutError', message);

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw createAbortError();
};

/** 简单延迟，signal 触发时立刻 reject（AbortError） */
export const delay = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());

      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(createAbortError());
    };

    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, Math.max(0, ms));

    signal?.addEventListener('abort', onAbort);
  });
};

/**
 * 给单次请求套超时与外部取消。
 *
 * 注意：fetcher 不接收 signal，所以超时/取消只是让本层提前返回，
 * 底层 fetch 仍可能跑完。请求幂等且低频，这里不做额外 abort 传递。
 */
const runWithTimeout = <T>(
  fetcher: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());

      return;
    }

    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (settle: () => void) => {
      if (settled) return;

      settled = true;

      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      settle();
    };

    const onAbort = () => finish(() => reject(createAbortError()));

    timer = setTimeout(
      () => finish(() => reject(createTimeoutError())),
      Math.max(1, timeoutMs)
    );
    signal?.addEventListener('abort', onAbort);

    let pending: Promise<T>;

    try {
      pending = fetcher();
    } catch (error) {
      // fetcher 同步抛错也要当作一次失败，而不是炸穿轮询
      finish(() => reject(error));

      return;
    }

    pending.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
};

/**
 * 轮询直到 predicate 为真或次数用尽。
 *
 * - 成功但 predicate 为假：保留该值，继续下一次；
 * - 失败（网络错误 / 超时）：保留上一次成功值，继续下一次；
 * - 全部尝试都失败、一次都没取到值：抛出最后一次的错误。
 */
export const pollUntil = async <T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  options: PollOptions = {}
): Promise<PollResult<T>> => {
  const total = Math.max(1, Math.floor(options.attempts ?? DEFAULT_ATTEMPTS));
  const intervalMs = Math.max(0, options.intervalMs ?? DEFAULT_INTERVAL_MS);
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const { onAttempt, signal } = options;

  let latest: { value: T } | null = null;
  let lastError: unknown;

  for (let attempt = 1; attempt <= total; attempt += 1) {
    throwIfAborted(signal);

    try {
      const value = await runWithTimeout(fetcher, timeoutMs, signal);

      latest = { value };

      if (predicate(value)) {
        return { value, attempts: attempt, exhausted: false };
      }
    } catch (error) {
      // 外部取消要立刻冒泡，不能当成一次普通失败重试
      if (isAbortError(error)) throw error;

      lastError = error;
    }

    onAttempt?.(attempt, total);

    if (attempt < total) {
      // 最后一次尝试后不再等待
      await delay(intervalMs, signal);
    }
  }

  if (!latest) {
    throw lastError instanceof Error
      ? lastError
      : new Error('轮询结束仍未能获取结果');
  }

  return { value: latest.value, attempts: total, exhausted: true };
};

export default pollUntil;
