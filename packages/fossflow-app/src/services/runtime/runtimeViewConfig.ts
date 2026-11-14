/**
 * 运行视图的系统配置。
 * 健康状态是否展示由配置决定，可在界面上动态切换并持久化。
 */
export interface RuntimeViewConfig {
  /** 是否在节点名称旁显示健康状态 */
  showNodeHealth: boolean;
}

const STORAGE_KEY = 'fossflow-runtime-view-config';

export const DEFAULT_RUNTIME_VIEW_CONFIG: RuntimeViewConfig = {
  showNodeHealth: true
};

export const loadRuntimeViewConfig = (): RuntimeViewConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return { ...DEFAULT_RUNTIME_VIEW_CONFIG };

    const parsed = JSON.parse(raw) as Partial<RuntimeViewConfig>;

    return {
      showNodeHealth:
        typeof parsed?.showNodeHealth === 'boolean'
          ? parsed.showNodeHealth
          : DEFAULT_RUNTIME_VIEW_CONFIG.showNodeHealth
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
