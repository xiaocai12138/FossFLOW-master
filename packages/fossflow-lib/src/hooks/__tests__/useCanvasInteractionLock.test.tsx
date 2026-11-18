import { render } from '@testing-library/react';
import { useCanvasInteractionLock } from '../useCanvasInteractionLock';
import {
  isCanvasInteractionLocked,
  resetCanvasInteractionLock
} from 'src/utils/canvasInteractionLock';

const LockedDialog = () => {
  useCanvasInteractionLock();

  return null;
};

const ClosedDialog = () => {
  useCanvasInteractionLock(false);

  return null;
};

describe('useCanvasInteractionLock', () => {
  afterEach(() => {
    resetCanvasInteractionLock();
    document.body.innerHTML = '';
  });

  it('弹窗挂载时锁定画布，卸载后释放', () => {
    const { unmount } = render(<LockedDialog />);

    expect(isCanvasInteractionLocked()).toBe(true);

    unmount();

    expect(isCanvasInteractionLocked()).toBe(false);
  });

  it('未打开时不锁定', () => {
    render(<ClosedDialog />);

    expect(isCanvasInteractionLocked()).toBe(false);
  });
});
