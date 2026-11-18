import { useEffect } from 'react';
import {
  lockCanvasInteractions,
  unlockCanvasInteractions
} from 'src/utils/canvasInteractionLock';

/**
 * 弹窗挂载期间锁定画布交互。
 *
 * 画布的事件监听挂在 window 上，不锁的话在弹窗里拖动/按键会连带平移底层地图。
 * 用计数锁而非布尔值，支持弹窗嵌套时逐个释放。
 */
export const useCanvasInteractionLock = (active = true): void => {
  useEffect(() => {
    if (!active) return;

    lockCanvasInteractions();

    return () => {
      unlockCanvasInteractions();
    };
  }, [active]);
};
