import React, { useCallback, useMemo, useRef } from 'react';
import { Box, useTheme, Typography, Stack } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { EditorModeEnum, DialogTypeEnum } from 'src/types';
import { UiElement } from 'components/UiElement/UiElement';
import { SceneLayer } from 'src/components/SceneLayer/SceneLayer';
import { DragAndDrop } from 'src/components/DragAndDrop/DragAndDrop';
import { ItemControlsManager } from 'src/components/ItemControls/ItemControlsManager';
import { ToolMenu } from 'src/components/ToolMenu/ToolMenu';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { MainMenu } from 'src/components/MainMenu/MainMenu';
import { ZoomControls } from 'src/components/ZoomControls/ZoomControls';
import { DebugUtils } from 'src/components/DebugUtils/DebugUtils';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { ContextMenuManager } from 'src/components/ContextMenu/ContextMenuManager';
import { useScene } from 'src/hooks/useScene';
import { useModelStore } from 'src/stores/modelStore';
import { ExportImageDialog } from '../ExportImageDialog/ExportImageDialog';
import { HelpDialog } from '../HelpDialog/HelpDialog';
import { SettingsDialog } from '../SettingsDialog/SettingsDialog';
import { ConnectorEmptySpaceTooltip } from '../ConnectorEmptySpaceTooltip/ConnectorEmptySpaceTooltip';
import { ConnectorRerouteTooltip } from '../ConnectorRerouteTooltip/ConnectorRerouteTooltip';
import { LassoHintTooltip } from '../LassoHintTooltip/LassoHintTooltip';
import { LazyLoadingWelcomeNotification } from '../LazyLoadingWelcomeNotification/LazyLoadingWelcomeNotification';

const ToolsEnum = {
  MAIN_MENU: 'MAIN_MENU',
  ZOOM_CONTROLS: 'ZOOM_CONTROLS',
  TOOL_MENU: 'TOOL_MENU',
  ITEM_CONTROLS: 'ITEM_CONTROLS',
  VIEW_TITLE: 'VIEW_TITLE'
} as const;

interface EditorModeMapping {
  [k: string]: (keyof typeof ToolsEnum)[];
}

const EDITOR_MODE_MAPPING: EditorModeMapping = {
  [EditorModeEnum.EDITABLE]: [
    'ITEM_CONTROLS',
    'ZOOM_CONTROLS',
    'TOOL_MENU',
    'MAIN_MENU',
    'VIEW_TITLE'
  ],
  [EditorModeEnum.EXPLORABLE_READONLY]: ['ZOOM_CONTROLS', 'VIEW_TITLE'],
  [EditorModeEnum.NON_INTERACTIVE]: []
};

const getEditorModeMapping = (editorMode: keyof typeof EditorModeEnum) => {
  const availableUiFeatures = EDITOR_MODE_MAPPING[editorMode];

  return availableUiFeatures;
};

export const UiOverlay = ({ runtimeToolbarExtra }: { runtimeToolbarExtra?: React.ReactNode }) => {
  const theme = useTheme();
  const contextMenuAnchorRef = useRef();
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const { appPadding } = theme.customVars;
  const runtimeInset = `var(--fossflow-runtime-control-inset, ${appPadding.x}px)`;
  const spacing = useCallback(
    (multiplier: number) => {
      return parseInt(theme.spacing(multiplier), 10);
    },
    [theme]
  );
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const enableDebugTools = useUiStateStore((state) => {
    return state.enableDebugTools;
  });
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const mouse = useUiStateStore((state) => {
    return state.mouse;
  });
  const dialog = useUiStateStore((state) => {
    return state.dialog;
  });
  const isMainMenuOpen = useUiStateStore((state) => {
    return state.isMainMenuOpen;
  });
  const customMainMenu = useUiStateStore((state) => {
    return state.customMainMenu;
  });
  const itemControls = useUiStateStore((state) => {
    return state.itemControls;
  });
  const isRuntime = useUiStateStore((state) => {
    return state.isRuntime;
  });
  const { currentView } = useScene();
  const editorMode = useUiStateStore((state) => {
    return state.editorMode;
  });
  const availableTools = useMemo(() => {
    return getEditorModeMapping(editorMode);
  }, [editorMode]);
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });
  const title = useModelStore((state) => {
    return state.title;
  });
  const iconPackManager = useUiStateStore((state) => {
    return state.iconPackManager;
  });
  const language = useUiStateStore((state) => {
    return state.language;
  });
  const supportedLanguages = useUiStateStore((state) => {
    return state.supportedLanguages;
  });
  const onLanguageChange = useUiStateStore((state) => {
    return state.onLanguageChange;
  });
  const { size: rendererSize } = useResizeObserver(rendererEl);

  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          width: 0,
          height: 0,
          top: 0,
          left: 0
        }}
      >
        {availableTools.includes('ITEM_CONTROLS') && itemControls && (
          <ItemControlsManager />
        )}

        {availableTools.includes('TOOL_MENU') && (
          <Box
            ref={toolMenuRef}
            sx={{
              position: 'absolute',
              transform: 'translateX(-100%)'
            }}
            style={{
              left: rendererSize.width - appPadding.x,
              top: appPadding.y
            }}
          >
            <ToolMenu />
          </Box>
        )}

        {availableTools.includes('ZOOM_CONTROLS') && (
          <Box
            sx={{
              position: 'absolute',
              transformOrigin: 'bottom left',
              transform: isRuntime ? 'translateX(-100%)' : undefined
            }}
            style={{
              top: isRuntime ? runtimeInset : rendererSize.height - appPadding.y * 2,
              left: isRuntime ? `calc(${rendererSize.width}px - ${runtimeInset})` : appPadding.x
            }}
          >
            <ZoomControls isRuntime={isRuntime} runtimeToolbarExtra={runtimeToolbarExtra} />
          </Box>
        )}

        {availableTools.includes('MAIN_MENU') && (
          <Box
            sx={{
              position: 'absolute'
            }}
            style={{
              top: appPadding.y,
              left: appPadding.x
            }}
          >
            <MainMenu />
          </Box>
        )}

        {availableTools.includes('VIEW_TITLE') && (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              justifyContent: 'center',
              transform: 'translateX(-50%)',
              pointerEvents: 'none'
            }}
            style={{
              left: rendererSize.width / 2,
              top: isRuntime
                ? `calc(${rendererSize.height}px - var(--fossflow-runtime-title-offset, 80px))`
                : rendererSize.height - appPadding.y * 2,
              width: isRuntime ? `calc(${rendererSize.width}px - 24px)` : rendererSize.width - 500,
              height: appPadding.y
            }}
          >
            <UiElement
              sx={{
                display: 'inline-flex',
                px: 2,
                alignItems: 'center',
                height: '100%'
              }}
            >
              <Stack direction="row" alignItems="center">
                <Typography fontWeight={600} color="text.secondary">
                  {title}
                </Typography>
                <ChevronRight />
                <Typography fontWeight={600} color="text.secondary">
                  {currentView.name}
                </Typography>
              </Stack>
            </UiElement>
          </Box>
        )}

        {enableDebugTools && (
          <UiElement
            sx={{
              position: 'absolute',
              width: 350,
              transform: 'translateY(-100%)'
            }}
            style={{
              maxWidth: `calc(${rendererSize.width} - ${appPadding.x * 2}px)`,
              left: appPadding.x,
              top: rendererSize.height - appPadding.y * 2 - spacing(1)
            }}
          >
            <DebugUtils />
          </UiElement>
        )}
      </Box>

      {mode.type === 'PLACE_ICON' && mode.id && (
        <SceneLayer disableAnimation>
          <DragAndDrop iconId={mode.id} tile={mouse.position.tile} />
        </SceneLayer>
      )}

      {dialog === DialogTypeEnum.EXPORT_IMAGE && (
        <ExportImageDialog
          onClose={() => {
            return uiStateActions.setDialog(null);
          }}
        />
      )}

      {dialog === DialogTypeEnum.HELP && <HelpDialog />}

      {dialog === DialogTypeEnum.SETTINGS && (
        <SettingsDialog
          iconPackManager={iconPackManager || undefined}
          language={language ?? undefined}
          supportedLanguages={supportedLanguages ?? undefined}
          onLanguageChange={onLanguageChange ?? undefined}
        />
      )}

      {/* Show hint tooltips only in editable mode */}
      {editorMode === EditorModeEnum.EDITABLE && <ConnectorEmptySpaceTooltip />}
      {editorMode === EditorModeEnum.EDITABLE && <ConnectorRerouteTooltip />}
      {editorMode === EditorModeEnum.EDITABLE && <LassoHintTooltip toolMenuRef={toolMenuRef} />}

      {/* 首次使用提示属于欢迎层：宿主使用自定义菜单（本靶场）或进入运行视图时不展示，
          避免盖住「APM 架构」菜单与应用弹窗 */}
      {iconPackManager && !customMainMenu && !isRuntime && !dialog && !isMainMenuOpen && (
        <LazyLoadingWelcomeNotification />
      )}

      <SceneLayer>
        <Box ref={contextMenuAnchorRef} />
        <ContextMenuManager anchorEl={contextMenuAnchorRef.current} />
      </SceneLayer>
    </>
  );
};
