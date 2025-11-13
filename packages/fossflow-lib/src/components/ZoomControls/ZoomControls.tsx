import React from 'react';
import {
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
  CropFreeOutlined as FitToScreenIcon,
  Help as HelpIcon,
  PanTool as PanToolIcon,
  NearMe as NearMeIcon,
} from '@mui/icons-material';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { toPx } from 'src/utils';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { MAX_ZOOM, MIN_ZOOM } from 'src/config';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useDiagramUtils } from 'src/hooks/useDiagramUtils';
import { DialogTypeEnum } from 'src/types/ui';

interface ZoomControlsProps {
  isRuntime?: boolean;
  actionEvent?: any;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({ isRuntime,actionEvent }) => {
  const uiActions = useUiStateStore((s) => s.actions);
  const zoom = useUiStateStore((s) => s.zoom);
  const mode = useUiStateStore((s) => s.mode);
  const selectedItem = useUiStateStore((s) => (s as any).selectedItem);  // ⭐ 当前选中的实体
  const { fitToView } = useDiagramUtils();

  // ⭐ Select 点击逻辑
  const handleSelectClick = () => {
    if (!isRuntime) {
      // 编辑模式，正常进入选择工具
      uiActions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null,
      });
    }else{
      // 运行模式，正常进入选择工具
      uiActions.setMode({
        type: 'RUNTIME CURSOR',
        showCursor: true,
        ActionEvent: actionEvent,
      });
    }
  };

  // ⭐ Pan 点击逻辑（你之前的）
  const handlePanClick = () => {
      uiActions.setMode({ type: 'PAN', showCursor: false });
      uiActions.setItemControls(null);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">

      {/* ⭐ Select 工具按钮 */}
      <UiElement>
        <IconButton
          name="Select"
          Icon={<NearMeIcon />}
          onClick={handleSelectClick}
          isActive={!isRuntime && (mode.type === 'CURSOR' || mode.type === 'DRAG_ITEMS')}
        />
      </UiElement>

      {/* ⭐ Pan 工具按钮 */}
      <UiElement>
        <IconButton
          name="Pan"
          Icon={<PanToolIcon />}
          onClick={handlePanClick}
          isActive={!isRuntime && mode.type === 'PAN'}
        />
      </UiElement>

      {/* 原有 Zoom 控件 */}
      <UiElement>
        <Stack direction="row">
          <IconButton
            name="Zoom out"
            Icon={<ZoomOutIcon />}
            onClick={uiActions.decrementZoom}
            disabled={zoom >= MAX_ZOOM}
          />
          <Divider orientation="vertical" flexItem />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: toPx(60),
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {Math.ceil(zoom * 100)}%
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <IconButton
            name="Zoom in"
            Icon={<ZoomInIcon />}
            onClick={uiActions.incrementZoom}
            disabled={zoom <= MIN_ZOOM}
          />
        </Stack>
      </UiElement>

      <UiElement>
        <IconButton
          name="Fit to screen"
          Icon={<FitToScreenIcon />}
          onClick={fitToView}
        />
      </UiElement>

      <UiElement>
        <IconButton
          name="Help (F1)"
          Icon={<HelpIcon />}
          onClick={() => uiActions.setDialog(DialogTypeEnum.HELP)}
        />
      </UiElement>
    </Stack>
  );
};
