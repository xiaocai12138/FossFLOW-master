import { Cursor } from '../modes/Cursor';
import type { State } from 'src/types';

/**
 * ArcMap 式交互：选择工具在空白处拖动不得隐式切到平移。
 * 平移只能通过工具条的 PAN 工具发起。
 */
describe('Cursor mode', () => {
  it('空白处拖动不会切换到 PAN', () => {
    const setMode = jest.fn();

    const uiState = {
      mode: { type: 'CURSOR', showCursor: true, mousedownItem: null },
      mouse: {
        position: { screen: { x: 10, y: 10 }, tile: { x: 10, y: 10 } },
        mousedown: { screen: { x: 1, y: 1 }, tile: { x: 1, y: 1 } },
        delta: { screen: { x: 9, y: 9 }, tile: { x: 9, y: 9 } }
      },
      actions: {
        setMode,
        setItemControls: jest.fn(),
        setContextMenu: jest.fn()
      }
    } as unknown as State['uiState'];

    // scene 在该分支不会被读取
    Cursor.mousemove!({
      uiState,
      scene: {} as State['scene'],
      model: {} as State['model'],
      rendererRef: {} as State['rendererRef'],
      rendererSize: { width: 800, height: 600 },
      isRendererInteraction: true
    } as State);

    expect(setMode).not.toHaveBeenCalled();
  });
});
