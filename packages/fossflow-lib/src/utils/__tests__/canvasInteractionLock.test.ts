import {
  isCanvasInteractionLocked,
  lockCanvasInteractions,
  resetCanvasInteractionLock,
  unlockCanvasInteractions
} from '../canvasInteractionLock';

describe('canvasInteractionLock', () => {
  afterEach(() => {
    resetCanvasInteractionLock();
    document.body.innerHTML = '';
  });

  it('没有锁也没有模态层时，画布可交互', () => {
    expect(isCanvasInteractionLocked()).toBe(false);
  });

  it('显式锁按计数生效，嵌套弹窗需要逐一解锁', () => {
    lockCanvasInteractions();
    lockCanvasInteractions();

    expect(isCanvasInteractionLocked()).toBe(true);

    unlockCanvasInteractions();
    expect(isCanvasInteractionLocked()).toBe(true);

    unlockCanvasInteractions();
    expect(isCanvasInteractionLocked()).toBe(false);
  });

  it.each(['rtm-backdrop', 'MuiDialog-root', 'dialog-overlay'])(
    'DOM 中存在 .%s 模态层时视为锁定（无需手动调用）',
    (className) => {
      const element = document.createElement('div');
      element.className = className;
      document.body.appendChild(element);

      expect(isCanvasInteractionLocked()).toBe(true);
    }
  );

  it('body 标记可跨组件兜底，reset 后恢复', () => {
    document.body.setAttribute('data-canvas-interaction-locked', 'true');

    expect(isCanvasInteractionLocked()).toBe(true);

    resetCanvasInteractionLock();

    expect(isCanvasInteractionLocked()).toBe(false);
  });

  it('非模态浮窗允许画布交互，同时保留其他模态层的锁', () => {
    document.body.innerHTML = '<div class="rtm-backdrop" data-canvas-interaction="allow"></div>';
    expect(isCanvasInteractionLocked()).toBe(false);

    document.body.insertAdjacentHTML('beforeend', '<div class="rtm-backdrop"></div>');
    expect(isCanvasInteractionLocked()).toBe(true);
  });
});
