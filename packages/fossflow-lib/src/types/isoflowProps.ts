import type { ReactNode } from 'react';
import type { EditorModeEnum, MainMenuOptions } from './common';
import type { Model } from './model';
import type { RendererProps } from './rendererProps';
import type { RuntimeOverlay } from './runtime';

export type InitialData = Model & {
  fitToView?: boolean;
  view?: string;
};

export interface LocaleProps {
  common: {
    exampleText: string;
  };
  mainMenu: {
    undo: string;
    redo: string;
    open: string;
    exportJson: string;
    exportCompactJson: string;
    exportImage: string;
    clearCanvas: string;
    settings: string;
    gitHub: string;
  };
  helpDialog: {
    title: string;
    close: string;
    keyboardShortcuts: string;
    mouseInteractions: string;
    action: string;
    shortcut: string;
    method: string;
    description: string;
    note: string;
    noteContent: string;
    // Keyboard shortcuts
    undoAction: string;
    undoDescription: string;
    redoAction: string;
    redoDescription: string;
    redoAltAction: string;
    redoAltDescription: string;
    helpAction: string;
    helpDescription: string;
    zoomInAction: string;
    zoomInShortcut: string;
    zoomInDescription: string;
    zoomOutAction: string;
    zoomOutShortcut: string;
    zoomOutDescription: string;
    panCanvasAction: string;
    panCanvasShortcut: string;
    panCanvasDescription: string;
    contextMenuAction: string;
    contextMenuShortcut: string;
    contextMenuDescription: string;
    // Mouse interactions
    selectToolAction: string;
    selectToolShortcut: string;
    selectToolDescription: string;
    panToolAction: string;
    panToolShortcut: string;
    panToolDescription: string;
    addItemAction: string;
    addItemShortcut: string;
    addItemDescription: string;
    drawRectangleAction: string;
    drawRectangleShortcut: string;
    drawRectangleDescription: string;
    createConnectorAction: string;
    createConnectorShortcut: string;
    createConnectorDescription: string;
    addTextAction: string;
    addTextShortcut: string;
    addTextDescription: string;
  };
  connectorHintTooltip: {
    tipCreatingConnectors: string;
    tipConnectorTools: string;
    clickInstructionStart: string;
    clickInstructionMiddle: string;
    clickInstructionEnd: string;
    nowClickTarget: string;
    dragStart: string;
    dragEnd: string;
    rerouteStart: string;
    rerouteMiddle: string;
    rerouteEnd: string;
  };
  lassoHintTooltip: {
    tipLasso: string;
    tipFreehandLasso: string;
    lassoDragStart: string;
    lassoDragEnd: string;
    freehandDragStart: string;
    freehandDragMiddle: string;
    freehandDragEnd: string;
    freehandComplete: string;
    moveStart: string;
    moveMiddle: string;
    moveEnd: string;
  };
  importHintTooltip: {
    title: string;
    instructionStart: string;
    menuButton: string;
    instructionMiddle: string;
    openButton: string;
    instructionEnd: string;
  };
  connectorRerouteTooltip: {
    title: string;
    instructionStart: string;
    instructionSelect: string;
    instructionMiddle: string;
    instructionClick: string;
    instructionAnd: string;
    instructionDrag: string;
    instructionEnd: string;
  };
  settings: {
    zoom: {
      /** 可选，未提供时回退到英文文案 */
      title?: string;
      description: string;
      zoomToCursor: string;
      zoomToCursorDesc: string;
    };
    hotkeys: {
      title: string;
      profile: string;
      profileQwerty: string;
      profileSmnrct: string;
      profileNone: string;
      tool: string;
      hotkey: string;
      toolSelect: string;
      toolPan: string;
      toolAddItem: string;
      toolRectangle: string;
      toolConnector: string;
      toolText: string;
      note: string;
    };
    pan: {
      title: string;
      mousePanOptions: string;
      emptyAreaClickPan: string;
      middleClickPan: string;
      rightClickPan: string;
      ctrlClickPan: string;
      altClickPan: string;
      keyboardPanOptions: string;
      arrowKeys: string;
      wasdKeys: string;
      ijklKeys: string;
      keyboardPanSpeed: string;
      note: string;
    };
    connector: {
      title: string;
      connectionMode: string;
      clickMode: string;
      clickModeDesc: string;
      dragMode: string;
      dragModeDesc: string;
      note: string;
    };
    iconPacks: {
      title: string;
      lazyLoading: string;
      lazyLoadingDesc: string;
      availablePacks: string;
      coreIsoflow: string;
      alwaysEnabled: string;
      awsPack: string;
      gcpPack: string;
      azurePack: string;
      kubernetesPack: string;
      loading: string;
      loaded: string;
      notLoaded: string;
      iconCount: string;
      lazyLoadingDisabledNote: string;
      note: string;
    };
    /** 语言设置，可选，未提供的语言文件会自动回退到英文。 */
    language?: {
      title: string;
      description: string;
      zhCN: string;
      enUS: string;
    };
    /** 图标管理，可选。 */
    iconManagement?: {
      title: string;
      importTitle: string;
      importDesc: string;
      selectFiles: string;
      listTitle: string;
      searchPlaceholder: string;
      empty: string;
      inspectorTitle: string;
      name: string;
      scale: string;
      isometric: string;
      source: string;
      sourceUnsupported: string;
      apply: string;
      copy: string;
      download: string;
      delete: string;
      applied: string;
      invalidSvg: string;
      preview: string;
      selectHint: string;
    };
  };
  lazyLoadingWelcome: {
    title: string;
    message: string;
    configPath: string;
    configPath2: string;
    canDisable: string;
    signature: string;
  };
  // other namespaces can be added here
}

export interface IconPackManagerProps {
  lazyLoadingEnabled: boolean;
  onToggleLazyLoading: (enabled: boolean) => void;
  packInfo: Array<{
    name: string;
    displayName: string;
    loaded: boolean;
    loading: boolean;
    error: string | null;
    iconCount: number;
  }>;
  enabledPacks: string[];
  onTogglePack: (packName: string, enabled: boolean) => void;
}

export interface CustomMainMenuAction {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'success' | 'accent';
}

export interface CustomMainMenuConfig {
  actions: CustomMainMenuAction[];
  languageControl?: ReactNode;
  iconSourceControl?: ReactNode;
  status?: {
    title: string;
    meta: string;
    note?: string;
  };
}

export interface IsoflowProps {
  initialData?: InitialData;
  mainMenuOptions?: MainMenuOptions;
  onModelUpdated?: (Model: Model) => void;
  width?: number | string;
  height?: number | string;
  enableDebugTools?: boolean;
  editorMode?: keyof typeof EditorModeEnum;
  renderer?: RendererProps;
  locale?: LocaleProps;
  iconPackManager?: IconPackManagerProps;
  customMainMenu?: CustomMainMenuConfig | null;
  isRuntime?: boolean;
  onRuntimeActionEvent?: (data: { item: any; tile: any }) => void;
  runtimeOverlay?: RuntimeOverlay | null;
  /** 当前界面语言代码，例如 zh-CN */
  language?: string;
  /** 宿主应用提供的可选语言 */
  supportedLanguages?: Array<{ label: string; value: string }>;
  /** 切换语言回调 */
  onLanguageChange?: (lang: string) => void;
}
