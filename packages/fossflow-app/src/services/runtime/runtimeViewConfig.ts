import { LOG_LEVELS } from './types';
import type { LogLevel } from './types';

export type LogColors = Record<LogLevel, string>;

export interface RuntimeViewConfig {
  /** 是否在节点名称旁显示健康状态 */
  showNodeHealth: boolean;
  nodeStatusRefreshSeconds: number;
  logColors: LogColors;
}

const STORAGE_KEY = 'fossflow-runtime-view-config';
export const MAX_NODE_STATUS_REFRESH_SECONDS = Math.floor(0x7fffffff / 1000);

export const isValidNodeStatusRefreshSeconds = (seconds: unknown): seconds is number =>
  typeof seconds === 'number' && Number.isInteger(seconds) &&
  seconds >= 1 && seconds <= MAX_NODE_STATUS_REFRESH_SECONDS;

export const DEFAULT_LOG_COLORS: Readonly<LogColors> = {
  DEBUG: '#64748b',
  INFO: '#075985',
  WARN: '#92400e',
  ERROR: '#b91c1c'
};

export const DEFAULT_RUNTIME_VIEW_CONFIG: RuntimeViewConfig = {
  showNodeHealth: true,
  nodeStatusRefreshSeconds: 10,
  logColors: DEFAULT_LOG_COLORS
};

export const loadRuntimeViewConfig = (): RuntimeViewConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return { ...DEFAULT_RUNTIME_VIEW_CONFIG };

    const parsed = JSON.parse(raw) as Partial<RuntimeViewConfig>;
    const logColors = { ...DEFAULT_LOG_COLORS };

    for (const level of LOG_LEVELS) {
      const color = parsed?.logColors?.[level];
      if (typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)) {
        logColors[level] = color;
      }
    }

    return {
      showNodeHealth:
        typeof parsed?.showNodeHealth === 'boolean'
          ? parsed.showNodeHealth
          : DEFAULT_RUNTIME_VIEW_CONFIG.showNodeHealth,
      nodeStatusRefreshSeconds: isValidNodeStatusRefreshSeconds(parsed?.nodeStatusRefreshSeconds)
        ? parsed.nodeStatusRefreshSeconds
        : DEFAULT_RUNTIME_VIEW_CONFIG.nodeStatusRefreshSeconds,
      logColors
    };
  } catch {
    return { ...DEFAULT_RUNTIME_VIEW_CONFIG };
  }
};

export const saveRuntimeViewConfig = (config: RuntimeViewConfig): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // 存储不可用时静默降级为内存态
  }
};
