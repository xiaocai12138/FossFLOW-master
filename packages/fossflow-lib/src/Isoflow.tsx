import React, { useEffect, useRef } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { Box } from '@mui/material';
import { theme } from 'src/styles/theme';
import { IsoflowProps } from 'src/types';
import { setWindowCursor, modelFromModelStore } from 'src/utils';
import { useModelStore, ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { LocaleProvider } from 'src/stores/localeStore';
import { GlobalStyles } from 'src/styles/GlobalStyles';
import { Renderer } from 'src/components/Renderer/Renderer';
import { UiOverlay } from 'src/components/UiOverlay/UiOverlay';
import { UiStateProvider, useUiStateStore } from 'src/stores/uiStateStore';
import { INITIAL_DATA, MAIN_MENU_OPTIONS } from 'src/config';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import enUS from 'src/i18n/en-US';

const App = ({
  initialData,
  mainMenuOptions = MAIN_MENU_OPTIONS,
  width = '100%',
  height = '100%',
  onModelUpdated,
  enableDebugTools = false,
  editorMode = 'EDITABLE',
  renderer,
  locale = enUS,
  iconPackManager,
  customMainMenu,
  isRuntime = false,
  runtimeToolbarExtra,
  onRuntimeActionEvent,
  runtimeOverlay = null,
  language,
  supportedLanguages,
  onLanguageChange,
}: IsoflowProps) => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const initialDataManager = useInitialDataManager();
  const model = useModelStore((state) => {
    return modelFromModelStore(state);
  });

  const { load } = initialDataManager;

  /**
   * 用 ref 持有回调，避免宿主每次渲染传新函数就触发一次
   * onModelUpdated → 宿主 setState → 再渲染 的反馈循环。
   */
  const onModelUpdatedRef = useRef(onModelUpdated);
  onModelUpdatedRef.current = onModelUpdated;
  /** 上一次已上报的 model 内容签名；内容不变时不再回调宿主 */
  const emittedModelSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    load({ ...INITIAL_DATA, ...initialData });
  }, [initialData, load]);

  useEffect(() => {
    uiStateActions.setEditorMode(editorMode);
    uiStateActions.setMainMenuOptions(mainMenuOptions);
  }, [editorMode, uiStateActions, mainMenuOptions]);

  useEffect(() => {
    return () => {
      setWindowCursor('default');
    };
  }, []);

  useEffect(() => {
    if (!initialDataManager.isReady || !onModelUpdatedRef.current) return;

    const signature = JSON.stringify(model);

    if (signature === emittedModelSignatureRef.current) return;

    emittedModelSignatureRef.current = signature;
    onModelUpdatedRef.current(model);
  }, [model, initialDataManager.isReady]);

  useEffect(() => {
    uiStateActions.setEnableDebugTools(enableDebugTools);
  }, [enableDebugTools, uiStateActions]);

  useEffect(() => {
    if (renderer?.expandLabels !== undefined) {
      uiStateActions.setExpandLabels(renderer.expandLabels);
    }
  }, [renderer?.expandLabels, uiStateActions]);

  useEffect(() => {
    uiStateActions.setIconPackManager(iconPackManager || null);
  }, [iconPackManager, uiStateActions]);

  useEffect(() => {
    uiStateActions.setCustomMainMenu(customMainMenu || null);
  }, [customMainMenu, uiStateActions]);

  useEffect(() => {
    if (isRuntime && onRuntimeActionEvent) {
      // 存储 actionEvent 到某个地方供 RuntimeCursor 使用
      // 这里我们使用 sessionStorage 或 Context，暂时先用一个全局变量存储
      (window as any).__runtimeActionEvent = onRuntimeActionEvent;
    }
    // 设置 isRuntime 状态
    uiStateActions.setIsRuntime(isRuntime);
  }, [isRuntime, onRuntimeActionEvent, uiStateActions]);

  useEffect(() => {
    uiStateActions.setRuntimeOverlay(runtimeOverlay ?? null);
  }, [runtimeOverlay, uiStateActions]);

  useEffect(() => {
    uiStateActions.setLanguage(language ?? null);
    uiStateActions.setSupportedLanguages(supportedLanguages ?? null);
    uiStateActions.setOnLanguageChange(onLanguageChange ?? null);
  }, [
    language,
    onLanguageChange,
    supportedLanguages,
    uiStateActions
  ]);

  if (!initialDataManager.isReady) return null;

  return (
    <>
      <GlobalStyles />
      <Box
        sx={{
          width,
          height,
          position: 'relative',
          overflow: 'hidden',
          transform: 'translateZ(0)'
        }}
      >
        <Renderer {...renderer} />
        <UiOverlay runtimeToolbarExtra={runtimeToolbarExtra} />
      </Box>
    </>
  );
};

export const Isoflow = (props: IsoflowProps) => {
  return (
    <ThemeProvider theme={theme}>
      <LocaleProvider locale={props.locale || enUS}>
        <ModelProvider>
          <SceneProvider>
            <UiStateProvider>
              <App {...props} />
            </UiStateProvider>
          </SceneProvider>
        </ModelProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
};

const useIsoflow = () => {
  const rendererEl = useUiStateStore((state) => {
    return state.rendererEl;
  });

  const ModelActions = useModelStore((state) => {
    return state.actions;
  });

  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  return {
    Model: ModelActions,
    uiState: uiStateActions,
    rendererEl
  };
};

export { useIsoflow };
export * from 'src/standaloneExports';
export default Isoflow;
