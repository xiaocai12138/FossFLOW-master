import React, { useCallback } from 'react';
import {
  AddOutlined as AddIcon,
  CropSquareOutlined as RectangleIcon,
  Title as TextIcon,
  DeleteOutline as DeleteIcon,
  TuneOutlined as SettingsIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  getTilePosition,
  CoordsUtils,
  generateId,
  findNearestUnoccupiedTile
} from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { useModelStore } from 'src/stores/modelStore';
import { VIEW_ITEM_DEFAULTS, TEXTBOX_DEFAULTS } from 'src/config';
import { ContextMenu } from './ContextMenu';

interface Props {
  anchorEl?: HTMLElement;
}

export const ContextMenuManager = ({ anchorEl }: Props) => {
  const scene = useScene();
  const model = useModelStore((state) => {
    return state;
  });
  const zoom = useUiStateStore((state) => {
    return state.zoom;
  });
  const contextMenu = useUiStateStore((state) => {
    return state.contextMenu;
  });

  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const onClose = useCallback(() => {
    uiStateActions.setContextMenu(null);
  }, [uiStateActions]);

  if (!contextMenu) {
    return null;
  }

  if (contextMenu.type === 'EMPTY') {
    return (
      <ContextMenu
        anchorEl={anchorEl}
        onClose={onClose}
        position={CoordsUtils.multiply(
          getTilePosition({ tile: contextMenu.tile }),
          zoom
        )}
        menuItems={[
          {
            label: '添加节点',
            icon: <AddIcon />,
            onClick: () => {
              if (model.icons.length > 0) {
                const modelItemId = generateId();
                const firstIcon = model.icons[0];

                // Find nearest unoccupied tile (should return the same tile since context menu is for empty tiles)
                const targetTile =
                  findNearestUnoccupiedTile(contextMenu.tile, scene) ??
                  contextMenu.tile;

                scene.placeIcon({
                  modelItem: {
                    id: modelItemId,
                    name: '未命名',
                    icon: firstIcon.id
                  },
                  viewItem: {
                    ...VIEW_ITEM_DEFAULTS,
                    id: modelItemId,
                    tile: targetTile
                  }
                });
              }
              onClose();
            }
          },
          {
            label: '添加区域',
            icon: <RectangleIcon />,
            onClick: () => {
              if (model.colors.length > 0) {
                scene.createRectangle({
                  id: generateId(),
                  color: model.colors[0].id,
                  from: contextMenu.tile,
                  to: contextMenu.tile
                });
              }
              onClose();
            }
          },
          {
            label: '添加文字',
            icon: <TextIcon />,
            onClick: () => {
              const textBoxId = generateId();

              scene.createTextBox({
                ...TEXTBOX_DEFAULTS,
                id: textBoxId,
                tile: contextMenu.tile
              });

              // 右键位置就是目标位置，直接打开文字编辑面板，无需再拖动落点。
              uiStateActions.setItemControls({
                type: 'TEXTBOX',
                id: textBoxId
              });
              onClose();
            }
          }
        ]}
      />
    );
  }

  // 节点右键菜单：打开属性面板 / 删除节点
  if (contextMenu.type === 'ITEM' && contextMenu.item) {
    const itemId = contextMenu.item.id;

    return (
      <ContextMenu
        anchorEl={anchorEl}
        onClose={onClose}
        position={CoordsUtils.multiply(
          getTilePosition({ tile: contextMenu.tile }),
          zoom
        )}
        menuItems={[
          {
            label: '节点设置',
            icon: <SettingsIcon />,
            onClick: () => {
              uiStateActions.setItemControls({ type: 'ITEM', id: itemId });
              onClose();
            }
          },
          {
            label: '删除节点',
            icon: <DeleteIcon />,
            danger: true,
            onClick: () => {
              // 先关面板，避免面板指向已删除的节点
              uiStateActions.setItemControls(null);
              scene.deleteViewItem(itemId);
              scene.deleteModelItem(itemId);
              onClose();
            }
          }
        ]}
      />
    );
  }

  return null;
};
