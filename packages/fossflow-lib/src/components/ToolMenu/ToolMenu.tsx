import React, { useCallback } from 'react';
import { Stack } from '@mui/material';
import {
  PanToolOutlined as PanToolIcon,
  NearMeOutlined as NearMeIcon,
  AddOutlined as AddIcon,
  EastOutlined as ConnectorIcon,
  CropSquareOutlined as CropSquareIcon,
  Title as TitleIcon,
  HighlightAltOutlined as LassoIcon,
  GestureOutlined as FreehandLassoIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconButton } from 'src/components/IconButton/IconButton';
import { UiElement } from 'src/components/UiElement/UiElement';
import { useScene } from 'src/hooks/useScene';
import { useTranslation } from 'src/stores/localeStore';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { generateId } from 'src/utils';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';

/**
 * 画布工具条（ArcMap 式交互）。
 *
 * 工具选中后保持激活，直到从工具条切换到另一个工具。
 *
 * 平移与选择不提供快捷键，也不能通过中键/空白处拖动等隐式手势触发 ——
 * 这是用户确认的交互约束（2026-11-14）。
 */
export const ToolMenu = () => {
  const { createTextBox } = useScene();
  const { t } = useTranslation('toolMenu');
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const uiStateStoreActions = useUiStateStore((state) => {
    return state.actions;
  });
  const mousePosition = useUiStateStore((state) => {
    return state.mouse.position.tile;
  });
  const hotkeyProfile = useUiStateStore((state) => {
    return state.hotkeyProfile;
  });

  const hotkeys = HOTKEY_PROFILES[hotkeyProfile];

  const toolLabel = (tool: keyof typeof hotkeys) => {
    const shortcut = hotkeys[tool];
    const label = t(tool);

    return shortcut ? `${label} (${shortcut.toUpperCase()})` : label;
  };

  const createTextBoxProxy = useCallback(() => {
    const textBoxId = generateId();

    createTextBox({
      ...TEXTBOX_DEFAULTS,
      id: textBoxId,
      tile: mousePosition
    });

    uiStateStoreActions.setMode({
      type: 'TEXTBOX',
      showCursor: false,
      id: textBoxId
    });
  }, [uiStateStoreActions, createTextBox, mousePosition]);

  return (
    <UiElement>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <IconButton
          name={toolLabel('select')}
          Icon={<NearMeIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'CURSOR',
              showCursor: true,
              mousedownItem: null
            });
          }}
          isActive={mode.type === 'CURSOR' || mode.type === 'DRAG_ITEMS'}
        />
        <IconButton
          name={toolLabel('lasso')}
          Icon={<LassoIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'LASSO',
              showCursor: true,
              selection: null,
              isDragging: false
            });
          }}
          isActive={mode.type === 'LASSO'}
        />
        <IconButton
          name={toolLabel('freehandLasso')}
          Icon={<FreehandLassoIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'FREEHAND_LASSO',
              showCursor: true,
              path: [],
              selection: null,
              isDragging: false
            });
          }}
          isActive={mode.type === 'FREEHAND_LASSO'}
        />
        <IconButton
          name={toolLabel('pan')}
          Icon={<PanToolIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'PAN',
              showCursor: false
            });

            uiStateStoreActions.setItemControls(null);
          }}
          isActive={mode.type === 'PAN'}
        />
        <IconButton
          name={toolLabel('addItem')}
          Icon={<AddIcon />}
          onClick={() => {
            uiStateStoreActions.setItemControls({
              type: 'ADD_ITEM'
            });
            uiStateStoreActions.setMode({
              type: 'PLACE_ICON',
              showCursor: true,
              id: null
            });
          }}
          isActive={mode.type === 'PLACE_ICON'}
        />
        <IconButton
          name={toolLabel('rectangle')}
          Icon={<CropSquareIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'RECTANGLE.DRAW',
              showCursor: true,
              id: null
            });
          }}
          isActive={mode.type === 'RECTANGLE.DRAW'}
        />
        <IconButton
          name={toolLabel('connector')}
          Icon={<ConnectorIcon />}
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'CONNECTOR',
              id: null,
              showCursor: true
            });
          }}
          isActive={mode.type === 'CONNECTOR'}
        />
        <IconButton
          name={toolLabel('text')}
          Icon={<TitleIcon />}
          onClick={createTextBoxProxy}
          isActive={mode.type === 'TEXTBOX'}
        />
      </Stack>
    </UiElement>
  );
};
