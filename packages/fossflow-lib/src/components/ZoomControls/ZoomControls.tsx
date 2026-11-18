import React from 'react';
import {
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
  CropFreeOutlined as FitToScreenIcon,
  Help as HelpIcon,
  NearMe as NearMeIcon,
  PanToolOutlined as PanToolIcon
} from '@mui/icons-material';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { toPx } from 'src/utils';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { MAX_ZOOM, MIN_ZOOM } from 'src/config';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';
import { useDiagramUtils } from 'src/hooks/useDiagramUtils';
import { DialogTypeEnum } from 'src/types/ui';

interface ZoomControlsProps {
  isRuntime?: boolean;
  actionEvent?: any;
  runtimeToolbarExtra?: React.ReactNode;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  isRuntime,
  actionEvent,
  runtimeToolbarExtra
}) => {
  const uiActions = useUiStateStore((s) => s.actions);
  const zoom = useUiStateStore((s) => s.zoom);
  const mode = useUiStateStore((s) => s.mode);
  const { fitToView } = useDiagramUtils();
  const { t: toolLabel } = useTranslation('toolMenu');
  const { t: helpLabel } = useTranslation('helpDialog');

  const handleRuntimeSelect = () => {
    uiActions.setMode({
      type: 'RUNTIME CURSOR',
      showCursor: true,
      ActionEvent: actionEvent,
      mousedownItem: null
    });
  };

  const zoomButtons = (
    <>
      <IconButton
        name={isRuntime ? helpLabel('zoomOutAction') : 'Zoom out (command)'}
        Icon={<ZoomOutIcon />}
        onClick={uiActions.decrementZoom}
        disabled={zoom <= MIN_ZOOM}
      />
      <Divider orientation="vertical" flexItem />
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: toPx(isRuntime ? 42 : 60),
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {Math.ceil(zoom * 100)}%
        </Typography>
      </Box>
      <Divider orientation="vertical" flexItem />
      <IconButton
        name={isRuntime ? helpLabel('zoomInAction') : 'Zoom in (command)'}
        Icon={<ZoomInIcon />}
        onClick={uiActions.incrementZoom}
        disabled={zoom >= MAX_ZOOM}
      />
    </>
  );

  const fitButton = (
    <IconButton
      name={isRuntime ? toolLabel('fitToView') : 'Fit to view (command)'}
      Icon={<FitToScreenIcon />}
      onClick={fitToView}
    />
  );

  if (isRuntime) {
    return (
      <UiElement>
        <Stack
          direction="row"
          alignItems="stretch"
          role="group"
          aria-label={toolLabel('canvasTools')}
          sx={{ '& > .MuiButton-root': { width: { xs: 32, sm: 40 } } }}
        >
          <IconButton
            name={toolLabel('select')}
            Icon={<NearMeIcon />}
            onClick={handleRuntimeSelect}
            isActive={mode.type === 'RUNTIME CURSOR'}
          />
          <IconButton
            name={toolLabel('pan')}
            Icon={<PanToolIcon />}
            onClick={() => uiActions.setMode({ type: 'PAN', showCursor: false })}
            isActive={mode.type === 'PAN'}
          />
          <Divider orientation="vertical" flexItem />
          {zoomButtons}
          <Divider orientation="vertical" flexItem />
          {fitButton}
          {runtimeToolbarExtra}
        </Stack>
      </UiElement>
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <UiElement>
        <Stack direction="row">{zoomButtons}</Stack>
      </UiElement>
      <UiElement>{fitButton}</UiElement>
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
