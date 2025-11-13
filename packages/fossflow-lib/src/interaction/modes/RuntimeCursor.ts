import { produce } from 'immer';
import { ModeActions, ModeActionsAction } from 'src/types';
import { getItemAtTile } from 'src/utils';

const mousedown: ModeActionsAction = ({
  uiState,
  scene,
  isRendererInteraction
}) => {
  if (uiState.mode.type !== 'RUNTIME CURSOR' || !isRendererInteraction) return;

  const itemAtTile = getItemAtTile({
    tile: uiState.mouse.position.tile,
    scene
  });

  if (itemAtTile) {
    // 记录点击的实体
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = itemAtTile;
      })
    );
  } else {
    // 点击空白，清空 mousedownItem，但不显示菜单
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
      })
    );
    uiState.actions.setItemControls(null);
  }
};

const mousemove: ModeActionsAction = ({ uiState }) => {
  if (uiState.mode.type !== 'RUNTIME CURSOR') return;

  // 在运行模式下，鼠标移动时什么都不做（不进入拖动模式）
  // 保持在 RUNTIME CURSOR 模式
};

const mouseup: ModeActionsAction = ({
  uiState,
  isRendererInteraction
}) => {
  if (uiState.mode.type !== 'RUNTIME CURSOR' || !isRendererInteraction) return;

  // 如果有点击的实体，调用 ActionEvent
  if (uiState.mode.mousedownItem) {
    const actionEvent = uiState.mode.ActionEvent || (window as any).__runtimeActionEvent;
    
    if (actionEvent) {
      actionEvent({
        item: uiState.mode.mousedownItem,
        tile: uiState.mouse.position.tile
      });
    }
  }

  // 清空 mousedownItem
  uiState.actions.setMode(
    produce(uiState.mode, (draft) => {
      draft.mousedownItem = null;
    })
  );
};

export const RuntimeCursor: ModeActions = {
  mousedown,
  mousemove,
  mouseup
};
