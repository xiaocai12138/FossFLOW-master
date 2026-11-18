/**
 * 画布交互锁。
 *
 * 目标：任何模态层（对话框、抽屉、导入/保存弹窗）打开时，画布不得响应
 * 鼠标、滚轮或键盘交互。尤其是拖动对话框时，底层地图不能跟着平移。
 *
 * 判定分两层：
 * 1. 显式锁：`lockCanvasInteractions()` / `unlockCanvasInteractions()` 计数，
 *    由弹窗组件在挂载/卸载时调用；
 * 2. DOM 兜底：模态层已经渲染时直接判定为锁定，避免每个弹窗都要记得接线
 *    （覆盖 MUI Dialog 与应用内自绘的 `.rtm-backdrop` / `.dialog-overlay`）。
 *
 * 计数而不是布尔值，是为了支持「弹窗里再开弹窗」时不提前解锁。
 */
const LOCK_ATTR = 'data-canvas-interaction-locked';

const MODAL_SELECTOR =
  '.MuiDialog-root, .rtm-backdrop:not([data-canvas-interaction="allow"]), .dialog-overlay';

let lockCount = 0;

const syncBodyAttribute = () => {
  if (typeof document === 'undefined' || !document.body) return;

  if (lockCount > 0) {
    document.body.setAttribute(LOCK_ATTR, 'true');
  } else {
    document.body.removeAttribute(LOCK_ATTR);
  }
};

export const lockCanvasInteractions = (): void => {
  lockCount += 1;
  syncBodyAttribute();
};

export const unlockCanvasInteractions = (): void => {
  lockCount = Math.max(0, lockCount - 1);
  syncBodyAttribute();
};

/** 供测试与路由切换兜底使用：直接清零，不依赖配对调用 */
export const resetCanvasInteractionLock = (): void => {
  lockCount = 0;
  syncBodyAttribute();
};

/**
 * 画布当前是否应忽略交互。
 *
 * 纯函数式读取 DOM，便于在 window 级事件处理器里高频调用。
 */
export const isCanvasInteractionLocked = (): boolean => {
  if (typeof document === 'undefined') return false;
  if (lockCount > 0) return true;

  if (document.body?.getAttribute(LOCK_ATTR) === 'true') return true;

  return Boolean(document.querySelector(MODAL_SELECTOR));
};

export const CANVAS_INTERACTION_LOCK_SELECTOR = MODAL_SELECTOR;
