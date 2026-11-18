import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Isoflow, allLocales } from 'fossflow';
import type { IsoflowProps } from 'fossflow';
import { lockCanvasInteractions, unlockCanvasInteractions } from 'fossflow';
import { useTranslation } from 'react-i18next';
import { DiagramManager } from '../components/DiagramManager';
import EditorSessionDialogs from '../components/EditorSessionDialogs';
import { StorageManager } from '../StorageManager';
import { storageManager } from '../services/storageService';
import { supportedLanguages } from '../i18n';
import { useIconPackManager } from '../services/iconPackManagerV2';
import { sanitizeDiagram } from '../services/diagramSanitizer';
import { ROUTES, RUNTIME_SEARCH_PARAMS } from '../routes';
import { DiagramData, extractSavableData } from '../diagramUtils';
import { SavedDiagram } from '../types/editor';
import { TopologyImportDialog } from '../components/TopologyImportDialog/TopologyImportDialog';
import { BackendArchitectureDialog } from '../components/BackendArchitectureDialog/BackendArchitectureDialog';
import { architectureStorage } from '../services/architectureStorage';
import type { ArchitectureRecord } from '../services/architectureStorage';
import '../App.css';

const editorMainMenuOptions: IsoflowProps['mainMenuOptions'] = [
  'ACTION.OPEN',
  'EXPORT.JSON',
  'EXPORT.PNG',
  'ACTION.CLEAR_CANVAS'
];

/** 当前画布关联的后台架构 id；刷新编辑器时用它恢复关联 */
const ARCHITECTURE_ID_KEY = 'fossflow-architecture-id';

/** 画布修改后延迟多久同步到后台，避免拖拽时每帧都发 PUT */
const ARCHITECTURE_SYNC_DEBOUNCE_MS = 1500;

/**
 * Main editor page.
 * Owns editor state, persistence flow, and page-level event handlers.
 */
export default function EditorWorkspace() {
  const iconPackManager = useIconPackManager();

  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [serverStorageAvailable, setServerStorageAvailable] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [fossflowKey, setFossflowKey] = useState(0);
  const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /** 服务器架构身份；与本地会话图表 id 是两套东西，不能混用 */
  const [serverArchitectureId, setServerArchitectureId] = useState<string | null>(
    () => localStorage.getItem(ARCHITECTURE_ID_KEY)
  );
  const [showArchitectureSaveDialog, setShowArchitectureSaveDialog] = useState(false);
  const [showArchitectureLoadDialog, setShowArchitectureLoadDialog] = useState(false);
  const [architectureError, setArchitectureError] = useState<string | null>(null);

  const architectureIdRef = useRef<string | null>(serverArchitectureId);
  const architectureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const architectureSaveRef = useRef<Promise<void>>(Promise.resolve());
  /** 刚从后台加载完时抑制自动保存，避免「加载 → 立即回写」的假修改 */
  const suppressArchitectureSaveUntilRef = useRef(0);

  const navigate = useNavigate();
  const { t, i18n } = useTranslation('app');

  const defaultColors = useMemo(
    () => [
      { id: 'blue', value: '#0066cc' },
      { id: 'green', value: '#00aa00' },
      { id: 'red', value: '#cc0000' },
      { id: 'orange', value: '#ff9900' },
      { id: 'purple', value: '#9900cc' },
      { id: 'black', value: '#000000' },
      { id: 'gray', value: '#666666' }
    ],
    []
  );

  /**
   * Cached data is kept as-is here on purpose: pack icons load over HTTP, so
   * repairing icon references at this point would strip them permanently.
   * `sanitizedDiagramData` repairs the shape later, once icons are available.
   */
  const [diagramData, setDiagramData] = useState<DiagramData>(() => {
    const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');

    if (lastOpenedData) {
      try {
        const data = JSON.parse(lastOpenedData);

        return {
          ...data,
          icons: data.icons || [],
          colors: data.colors?.length ? data.colors : defaultColors,
          // fitToView 原样保留：它是 useInitialDataManager 唯一消费的视野字段，
          // 覆盖成 fitToScreen 会让图停在默认缩放，节点落在视口外
          fitToView: data.fitToView ?? true,
          fitToScreen: data.fitToScreen !== false
        };
      } catch (error) {
        console.error('Failed to load last opened data:', error);
      }
    }

    return {
      title: 'Untitled Diagram',
      icons: [],
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
  });

  /**
   * Cached diagrams go through several save paths that trim icons and can leave
   * dangling references, malformed colours or over-long names behind. Repair
   * the shape instead of failing model validation and blanking the canvas.
   */
  const sanitizedDiagramData = useMemo<DiagramData>(() => {
    const withIcons = {
      ...diagramData,
      icons: [
        ...(diagramData.icons ?? []),
        ...(iconPackManager.loadedIcons.length > 0
          ? iconPackManager.loadedIcons.filter(
              (icon) => !(diagramData.icons ?? []).some((own) => own.id === icon.id)
            )
          : [])
      ]
    };
    const { data, changes } = sanitizeDiagram(withIcons);

    if (changes.length > 0) {
      console.warn('[fossflow] repaired diagram before loading', changes);
    }

    return data as DiagramData;
  }, [diagramData, iconPackManager.loadedIcons]);

  useEffect(() => {
    storageManager
      .initialize()
      .then(() => {
        setServerStorageAvailable(storageManager.isServerStorage());
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const loadedIcons = iconPackManager.loadedIcons;

    if (loadedIcons.length === 0) return;

    setDiagramData((previous) => {
      const byId = new Map<string, any>();

      // Existing icons win only for ids the packs do not provide, so persisted
      // custom icons survive while pack icons stay current.
      (previous.icons || []).forEach((icon) => byId.set(icon.id, icon));
      loadedIcons.forEach((icon) => byId.set(icon.id, icon));

      const merged = Array.from(byId.values());
      const unchanged =
        merged.length === (previous.icons || []).length &&
        merged.every((icon, index) => icon === (previous.icons || [])[index]);

      return unchanged ? previous : { ...previous, icons: merged };
    });
  }, [iconPackManager.loadedIcons]);

  useEffect(() => {
    const savedDiagrams = localStorage.getItem('fossflow-diagrams');
    if (!savedDiagrams) return;

    setDiagrams(JSON.parse(savedDiagrams));

    const lastOpenedId = localStorage.getItem('fossflow-last-opened');
    if (!lastOpenedId) return;

    try {
      const allDiagrams = JSON.parse(savedDiagrams);
      const lastDiagram = allDiagrams.find(
        (diagram: SavedDiagram) => diagram.id === lastOpenedId
      );

      if (lastDiagram) {
        setCurrentDiagram(lastDiagram);
        setDiagramName(lastDiagram.name);
        setCurrentModel(diagramData);
      }
    } catch (error) {
      console.error('Failed to restore last diagram metadata:', error);
    }
  }, [diagramData]);

  useEffect(() => {
    try {
      /**
       * 存档列表里保留每个图真正用到的图标定义。
       *
       * 原先一律写成 `icons: []` 以省空间，但恢复时只能靠异步的图标包补回；
       * 补回之前 `modelSchema` 会因为悬空的 icon 引用导致整图校验失败、画布空白。
       * 只保留被 items 引用到的定义，体积可控且不破坏可加载性。
       */
      const diagramsToStore = diagrams.map((diagram) => {
        const allIcons: any[] = Array.isArray(diagram.data?.icons)
          ? diagram.data.icons
          : [];
        const referenced = new Set(
          (diagram.data?.items ?? [])
            .map((item: any) => item?.icon)
            .filter(Boolean)
        );

        return {
          ...diagram,
          data: {
            ...diagram.data,
            icons: allIcons.filter(
              (icon: any) =>
                icon?.collection === 'imported' || referenced.has(icon?.id)
            )
          }
        };
      });

      localStorage.setItem('fossflow-diagrams', JSON.stringify(diagramsToStore));
    } catch (error) {
      console.error('Failed to save diagrams:', error);

      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert(t('alert.quotaExceeded'));
      }
    }
  }, [diagrams, t]);

  useEffect(() => {
    if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

    const autoSaveTimer = setTimeout(() => {
      /**
       * 持久化时必须带上 item 真正引用到的图标定义。
       *
       * 之前只保留 `collection === 'imported'`，会把图标包（isoflow/kubernetes 等）
       * 提供的定义全部丢掉；可是 items 仍然引用着这些 id，
       * `modelSchema` 会因「item references an icon that does not exist」整图校验失败，
       * 表现为画布空白。改为按 items 的实际引用集合保留。
       */
      const modelIcons = currentModel?.icons || diagramData.icons || [];
      const referencedIconIds = new Set(
        (currentModel?.items || []).map((item: any) => item?.icon).filter(Boolean)
      );
      const persistedIcons = modelIcons.filter(
        (icon: any) =>
          icon?.collection === 'imported' || referencedIconIds.has(icon?.id)
      );

      const savedData = {
        title: diagramName || currentDiagram.name,
        icons: persistedIcons,
        colors: currentModel.colors || [],
        items: currentModel.items || [],
        views: currentModel.views || [],
        // fitToView 是唯一被 useInitialDataManager 消费的视野字段
        fitToView: currentModel.fitToView ?? diagramData.fitToView ?? true,
        fitToScreen: true
      };

      const updatedDiagram: SavedDiagram = {
        ...currentDiagram,
        data: savedData,
        updatedAt: new Date().toISOString()
      };

      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === currentDiagram.id ? updatedDiagram : diagram
        )
      );

      try {
        localStorage.setItem(
          'fossflow-last-opened-data',
          JSON.stringify(savedData)
        );
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Auto-save failed:', error);

        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          alert(t('alert.autoSaveFailed'));
          setShowStorageManager(true);
        }
      }
    }, 5000);

    return () => clearTimeout(autoSaveTimer);
  }, [currentDiagram, currentModel, diagramData.icons, diagramName, hasUnsavedChanges, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
      event.returnValue = t('alert.beforeUnload');
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, t]);

  /**
   * 任意应用级弹窗打开时锁定画布。
   *
   * 应用内既有 MUI Dialog，也有自绘的 `.dialog-overlay`；画布监听在 window 上，
   * 不显式锁定的话拖动对话框会连带移动地图。
   */
  const hasOpenDialog =
    showSaveDialog ||
    showLoadDialog ||
    showExportDialog ||
    showDiagramManager ||
    showStorageManager ||
    showImportDialog ||
    showArchitectureSaveDialog ||
    showArchitectureLoadDialog;

  useEffect(() => {
    if (!hasOpenDialog) return;

    lockCanvasInteractions();

    return () => unlockCanvasInteractions();
  }, [hasOpenDialog]);

  /**
   * 记录/清空服务器架构身份。
   *
   * ref 与 state 同时维护：防抖回调在异步路径上执行，读 state 会拿到旧值。
   */
  const setArchitectureId = (id: string | null) => {
    architectureIdRef.current = id;
    setServerArchitectureId(id);

    try {
      if (id) localStorage.setItem(ARCHITECTURE_ID_KEY, id);
      else localStorage.removeItem(ARCHITECTURE_ID_KEY);
    } catch (error) {
      console.error('Failed to persist architecture id:', error);
    }
  };

  /**
   * 防抖保存真正落盘时使用的最新载荷。
   *
   * 不能在 schedule 时把 model 闭包进定时器：`handleModelUpdated` /
   * `handleTopologyImported` 都是在 setState 之后立刻调度保存，闭包里的
   * `currentModel` 还是修改前的值，会导致每次自动保存都落后一步。
   */
  const architecturePayloadRef = useRef<{
    title: string;
    diagram: DiagramData;
  } | null>(null);

  /**
   * 替换画布（导入拓扑 / 加载后台架构）时，旧 Isoflow 实例可能在卸载前
   * 再回调一次旧 model。这里记录替换前的内容签名，收到同签名回调时忽略，
   * 避免刚导入的图被旧内容覆盖。
   */
  const staleModelSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const model = currentModel || diagramData;

    architecturePayloadRef.current = {
      title: diagramName.trim() || model.title || 'MSC 架构',
      diagram: extractSavableData(model)
    };
  }, [currentModel, diagramData, diagramName]);

  const architecturePayload = () => {
    if (architecturePayloadRef.current) return architecturePayloadRef.current;

    const model = currentModel || diagramData;

    return {
      title: diagramName.trim() || model.title || 'MSC 架构',
      diagram: extractSavableData(model)
    };
  };

  const saveArchitectureNow = useCallback(async (): Promise<boolean> => {
    const id = architectureIdRef.current;

    if (!id) return true;

    const { title, diagram } = architecturePayload();

    try {
      await architectureStorage.save(id, title, diagram);

      setArchitectureError(null);

      return true;
    } catch (error) {
      // 同步失败必须可见：静默失败等于丢用户的修改
      setArchitectureError(
        error instanceof Error ? error.message : '后台架构同步失败'
      );

      return false;
    }
  }, [architecturePayload]);

  /** 串行排队保存，避免并发编辑时旧响应覆盖新内容 */
  const queueArchitectureSave = useCallback(
    (respectSuppression: boolean): Promise<boolean> => {
      let result = true;

      const run = async () => {
        if (!architectureIdRef.current) return;
        if (
          respectSuppression &&
          Date.now() < suppressArchitectureSaveUntilRef.current
        ) {
          return;
        }

        result = await saveArchitectureNow();
      };

      const chained = architectureSaveRef.current.then(run, run);

      architectureSaveRef.current = chained.then(
        () => undefined,
        () => undefined
      );

      return chained.then(() => result);
    },
    [saveArchitectureNow]
  );

  const scheduleArchitectureSave = useCallback(() => {
    if (!architectureIdRef.current) return;

    // 已有等待中的保存就不要再重置窗口：持续编辑否则永远等不到触发点
    if (architectureTimerRef.current) return;

    const suppressedUntil = suppressArchitectureSaveUntilRef.current;
    const remaining = suppressedUntil - Date.now();

    /**
     * 抑制窗口内的编辑不能被丢掉：等窗口结束后补一次保存。
     * （窗口只用于避免「刚加载完就把旧内容写回」。）
     */
    if (remaining > 0) {
      architectureTimerRef.current = setTimeout(() => {
        architectureTimerRef.current = null;
        void queueArchitectureSave(false);
      }, remaining + 50);

      return;
    }

    architectureTimerRef.current = setTimeout(() => {
      architectureTimerRef.current = null;
      void queueArchitectureSave(false);
    }, ARCHITECTURE_SYNC_DEBOUNCE_MS);
  }, [queueArchitectureSave]);

  /** 进入运行视图前强制落盘，保证运行页读到的是最新画布 */
  const flushArchitectureSave = useCallback(async (): Promise<boolean> => {
    if (architectureTimerRef.current) {
      clearTimeout(architectureTimerRef.current);
      architectureTimerRef.current = null;
    }

    return queueArchitectureSave(false);
  }, [queueArchitectureSave]);

  useEffect(
    () => () => {
      if (architectureTimerRef.current) clearTimeout(architectureTimerRef.current);
    },
    []
  );

  /**
   * 刷新编辑器时若已关联后台架构，先短暂抑制自动保存。
   *
   * 本地缓存可能落后于后台，直接回写会把后台内容覆盖成旧版本；
   * 抑制窗口内的用户编辑仍会补一次保存（见 scheduleArchitectureSave）。
   */
  useEffect(() => {
    if (architectureIdRef.current) {
      suppressArchitectureSaveUntilRef.current = Date.now() + 3000;
    }
  }, []);

  const handleArchitectureSaved = (record: ArchitectureRecord) => {
    setArchitectureId(record.id);
    setDiagramName(record.title);
    setHasUnsavedChanges(false);
    setShowArchitectureSaveDialog(false);
    setArchitectureError(null);

    try {
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(extractSavableData(record.diagram))
      );
    } catch (error) {
      console.error('Failed to persist architecture locally:', error);
    }
  };

  /**
   * 从后台加载架构并替换画布。
   *
   * 加载期间抑制自动保存，否则「读到 A、立刻把当前画布写回 A」会覆盖后台内容。
   */
  const handleArchitectureLoaded = async (record: ArchitectureRecord) => {
    const data = record.diagram as DiagramData;

    await iconPackManager.loadPacksForDiagram(data.items || []);

    const iconById = new Map<string, any>();

    [...iconPackManager.loadedIcons, ...(data.icons ?? [])].forEach((icon) => {
      if (icon?.id && !iconById.has(icon.id)) iconById.set(icon.id, icon);
    });

    const merged: DiagramData = {
      ...data,
      icons: Array.from(iconById.values()),
      colors: data.colors?.length ? data.colors : defaultColors,
      fitToScreen: data.fitToScreen !== false
    };

    suppressArchitectureSaveUntilRef.current = Date.now() + 3000;
    staleModelSignatureRef.current = modelSignature(currentModel || diagramData);

    setArchitectureId(record.id);
    setDiagramName(record.title);
    setCurrentDiagram(null);
    setDiagramData(merged);
    setCurrentModel(merged);
    setHasUnsavedChanges(false);
    setShowArchitectureLoadDialog(false);
    setArchitectureError(null);

    try {
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(extractSavableData(merged))
      );
    } catch (error) {
      console.error('Failed to persist loaded architecture:', error);
    }
  };

  const handleSaveDiagram = () => {
    if (!diagramName.trim()) {
      alert(t('alert.enterDiagramName'));
      return;
    }

    const existingDiagram = diagrams.find(
      (diagram) => diagram.name === diagramName.trim() && diagram.id !== currentDiagram?.id
    );

    if (existingDiagram) {
      const confirmOverwrite = window.confirm(
        t('alert.diagramExists', { name: diagramName })
      );

      if (!confirmOverwrite) return;
    }

    const importedIcons = (currentModel?.icons || diagramData.icons || []).filter(
      (icon) => icon.collection === 'imported'
    );

    const savedData: DiagramData = {
      title: diagramName,
      icons: importedIcons,
      colors: currentModel?.colors || diagramData.colors || [],
      items: currentModel?.items || diagramData.items || [],
      views: currentModel?.views || diagramData.views || [],
      fitToView: currentModel?.fitToView ?? diagramData.fitToView,
      fitToScreen: true
    };

    const nextDiagram: SavedDiagram = {
      id: currentDiagram?.id || Date.now().toString(),
      name: diagramName,
      data: savedData,
      createdAt: currentDiagram?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (currentDiagram) {
      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === currentDiagram.id ? nextDiagram : diagram
        )
      );
    } else if (existingDiagram) {
      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === existingDiagram.id
            ? {
                ...nextDiagram,
                id: existingDiagram.id,
                createdAt: existingDiagram.createdAt
              }
            : diagram
        )
      );
      nextDiagram.id = existingDiagram.id;
      nextDiagram.createdAt = existingDiagram.createdAt;
    } else {
      setDiagrams((previous) => [...previous, nextDiagram]);
    }

    setCurrentDiagram(nextDiagram);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);

    try {
      localStorage.setItem('fossflow-last-opened', nextDiagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(nextDiagram.data)
      );
    } catch (error) {
      console.error('Failed to save diagram:', error);

      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert(t('alert.storageFull'));
        setShowStorageManager(true);
      }
    }
  };

  const handleLoadDiagram = async (diagram: SavedDiagram) => {
    if (hasUnsavedChanges && !window.confirm(t('alert.unsavedChanges'))) {
      return;
    }

    await iconPackManager.loadPacksForDiagram(diagram.data.items || []);

    const importedIcons = (diagram.data.icons || []).filter(
      (icon: any) => icon.collection === 'imported'
    );
    const dataWithIcons = {
      ...diagram.data,
      icons: [...iconPackManager.loadedIcons, ...importedIcons]
    };

    setCurrentDiagram(diagram);
    setDiagramName(diagram.name);
    setDiagramData(dataWithIcons);
    setCurrentModel(dataWithIcons);
    setFossflowKey((previous) => previous + 1);
    setShowLoadDialog(false);
    setHasUnsavedChanges(false);
    // 本地会话图表没有服务器身份，避免把别的内容写回已关联的后台架构
    setArchitectureId(null);
    setArchitectureError(null);

    try {
      localStorage.setItem('fossflow-last-opened', diagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(diagram.data)
      );
    } catch (error) {
      console.error('Failed to save last opened:', error);
    }
  };

  const handleDeleteDiagram = (id: string) => {
    if (!window.confirm(t('alert.confirmDelete'))) return;

    setDiagrams((previous) => previous.filter((diagram) => diagram.id !== id));

    if (currentDiagram?.id === id) {
      setCurrentDiagram(null);
      setDiagramName('');
    }
  };

  const handleCreateNewDiagram = () => {
    const message = hasUnsavedChanges
      ? t('alert.unsavedChangesExport')
      : t('alert.createNewDiagram');

    if (!window.confirm(message)) return;

    const emptyDiagram: DiagramData = {
      title: 'Untitled Diagram',
      icons: iconPackManager.loadedIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };

    setCurrentDiagram(null);
    setDiagramName('');
    setDiagramData(emptyDiagram);
    setCurrentModel(emptyDiagram);
    setFossflowKey((previous) => previous + 1);
    setHasUnsavedChanges(false);
    // 新图表不继承旧的后台架构身份
    setArchitectureId(null);
    setArchitectureError(null);

    localStorage.removeItem('fossflow-last-opened');
    localStorage.removeItem('fossflow-last-opened-data');
  };

  /**
   * 导入服务拓扑后重建画布。
   *
   * `setFossflowKey` 不能省：useInitialDataManager 有深度比较，
   * 数据看似「没变」时会跳过重载，画布不会刷新。
   */
  const handleTopologyImported = async (
    diagram: DiagramData,
    warnings: string[]
  ) => {
    await iconPackManager.loadPacksForDiagram(diagram.items ?? []);

    // 图标包提供的真实 SVG 优先，同 id 的兜底图标不再重复入表
    const iconById = new Map<string, any>();

    [...iconPackManager.loadedIcons, ...(diagram.icons ?? [])].forEach((icon) => {
      if (icon?.id && !iconById.has(icon.id)) iconById.set(icon.id, icon);
    });

    const merged: DiagramData = {
      ...diagram,
      icons: Array.from(iconById.values())
    };

    staleModelSignatureRef.current = modelSignature(currentModel || diagramData);

    setDiagramData(merged);
    setCurrentModel(merged);
    setDiagramName(merged.title);
    setHasUnsavedChanges(true);
    setShowImportDialog(false);
    // 已关联后台架构时，导入结果要通过防抖同步回同一 ID
    scheduleArchitectureSave();

    try {
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(extractSavableData(merged))
      );
    } catch (error) {
      console.error('Failed to persist imported topology:', error);
    }

    if (warnings.length) console.warn('[topology-import]', warnings);
  };

  /**
   * 内容签名刻意不含 icons：图标包异步补齐会改变 icons 数组，
   * 但不改变「这张图是不是刚才那张」的判断，含 icons 会让旧回调漏过保护。
   */
  const modelSignature = (model: DiagramData): string =>
    JSON.stringify({
      title: model.title,
      colors: model.colors,
      items: model.items,
      views: model.views
    });

  const handleModelUpdated = (model: any) => {
    const updatedModel: DiagramData = {
      title: model.title || diagramName || 'Untitled Diagram',
      icons: model.icons || [],
      colors: model.colors || defaultColors,
      items: model.items || [],
      views: model.views || [],
      fitToView: model.fitToView ?? diagramData.fitToView,
      fitToScreen: true
    };

    if (staleModelSignatureRef.current === modelSignature(updatedModel)) {
      staleModelSignatureRef.current = null;

      return;
    }

    setCurrentModel(updatedModel);
    setDiagramData(updatedModel);
    setHasUnsavedChanges(true);
    scheduleArchitectureSave();
  };

  const handleExportDiagram = () => {
    const modelToExport = currentModel || diagramData;
    const allModelIcons = modelToExport.icons || [];
    const diagramImportedIcons = (diagramData.icons || []).filter(
      (icon) => icon.collection === 'imported'
    );

    const iconMap = new Map();
    allModelIcons.forEach((icon) => iconMap.set(icon.id, icon));
    diagramImportedIcons.forEach((icon) => {
      if (!iconMap.has(icon.id)) {
        iconMap.set(icon.id, icon);
      }
    });

    const exportData = {
      title: diagramName || modelToExport.title || 'Exported Diagram',
      icons: Array.from(iconMap.values()),
      colors: modelToExport.colors || [],
      items: modelToExport.items || [],
      views: modelToExport.views || [],
      fitToScreen: true
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${diagramName || 'diagram'}-${new Date()
      .toISOString()
      .split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setShowExportDialog(false);
    setHasUnsavedChanges(false);
  };

  const handleDiagramManagerLoad = async (id: string, data: any) => {
    await iconPackManager.loadPacksForDiagram(data.items || []);

    const loadedIcons = data.icons || [];
    const hasDefaultIcons = loadedIcons.some(
      (icon: any) =>
        icon.collection === 'isoflow' ||
        icon.collection === 'aws' ||
        icon.collection === 'gcp'
    );

    const finalIcons = hasDefaultIcons
      ? loadedIcons
      : [
          ...iconPackManager.loadedIcons,
          ...loadedIcons.filter((icon: any) => icon.collection === 'imported')
        ];

    const mergedData: DiagramData = {
      ...data,
      title: data.title || data.name || 'Loaded Diagram',
      icons: finalIcons,
      colors: data.colors?.length ? data.colors : defaultColors,
      fitToScreen: data.fitToScreen !== false
    };

    const loadedDiagram: SavedDiagram = {
      id,
      name: data.name || 'Loaded Diagram',
      data: mergedData,
      createdAt: data.created || new Date().toISOString(),
      updatedAt: data.lastModified || new Date().toISOString()
    };

    setDiagramName(loadedDiagram.name);
    setCurrentDiagram(loadedDiagram);
    setCurrentModel(mergedData);
    setHasUnsavedChanges(false);
    setDiagramData(mergedData);
    setFossflowKey((previous) => previous + 1);
    // 通用图表管理器读到的不是后台架构，解除关联以免误覆盖
    setArchitectureId(null);
    setArchitectureError(null);
  };

  const handleOpenSaveDialog = () => setShowSaveDialog(true);
  const handleOpenLoadDialog = () => setShowLoadDialog(true);
  const handleOpenExportDialog = () => setShowExportDialog(true);
  const handleOpenServerStorage = () => setShowDiagramManager(true);
  const handleCloseSaveDialog = () => setShowSaveDialog(false);
  const handleCloseLoadDialog = () => setShowLoadDialog(false);
  const handleCloseExportDialog = () => setShowExportDialog(false);
  const handleCloseDiagramManager = () => setShowDiagramManager(false);
  const handleOpenRunView = async () => {
    const target = currentModel || diagramData;

    setDiagramData(target);

    try {
      localStorage.setItem('fossflow-last-opened-data', JSON.stringify(target));

      if (currentDiagram?.id) {
        localStorage.setItem('fossflow-last-opened', currentDiagram.id);
      }
    } catch (error) {
      console.error('Failed to persist diagram before entering runtime view:', error);
    }

    const architectureId = architectureIdRef.current;
    const params = new URLSearchParams();

    if (architectureId) {
      // 运行页只认服务器数据，先确保最新画布已落盘
      const synced = await flushArchitectureSave();

      if (!synced) {
        const message =
          '当前画布未能同步到后台架构，已阻止进入运行视图，避免看到旧内容';
        setArchitectureError(message);
        window.alert(message);

        return;
      }

      params.set(RUNTIME_SEARCH_PARAMS.architectureId, architectureId);
    } else if (currentDiagram) {
      // 未关联后台架构时退回本地图表 id
      params.set(RUNTIME_SEARCH_PARAMS.diagramId, currentDiagram.id);
    }

    const search = params.toString();

    navigate(`${ROUTES.runtime}${search ? `?${search}` : ''}`);
  };

  const handleQuickSaveSession = () => {
    if (currentDiagram && hasUnsavedChanges) {
      handleSaveDiagram();
    }
  };

  const iconPackManagerProps = {
    lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
    onToggleLazyLoading: iconPackManager.toggleLazyLoading,
    packInfo: Object.values(iconPackManager.packInfo),
    enabledPacks: iconPackManager.enabledPacks,
    onTogglePack: iconPackManager.togglePack
  };

  const handleLanguageChange = (lang: string) => {
    if (i18n.language === lang) return;

    void i18n.changeLanguage(lang);
  };

  return (
    <div className="App">
      <div className="fossflow-container">
        {!iconPackManager.isInitialLoadComplete && (
          <div className="fossflow-loading">正在加载图标资源…</div>
        )}
        {iconPackManager.isInitialLoadComplete && (
          <Isoflow
            key={fossflowKey}
            initialData={sanitizedDiagramData}
            onModelUpdated={handleModelUpdated}
            editorMode="EDITABLE"
            mainMenuOptions={editorMainMenuOptions}
            locale={allLocales[i18n.language as keyof typeof allLocales]}
            iconPackManager={iconPackManagerProps}
            language={i18n.language}
            supportedLanguages={supportedLanguages}
            onLanguageChange={handleLanguageChange}
            customMainMenu={{
              actions: [
                {
                  id: 'new-diagram',
                  section: 'file',
                  label: t('nav.newDiagram'),
                  onClick: handleCreateNewDiagram
                },
                {
                  id: 'save-session',
                  section: 'file',
                  label: t('nav.saveSessionOnly'),
                  onClick: handleOpenSaveDialog
                },
                {
                  id: 'load-session',
                  section: 'file',
                  label: t('nav.loadSessionOnly'),
                  onClick: handleOpenLoadDialog
                },
                {
                  id: 'export-file',
                  section: 'file',
                  label: t('nav.exportFile'),
                  onClick: handleOpenExportDialog
                },
                {
                  id: 'quick-save',
                  section: 'file',
                  label: t('nav.quickSaveSession'),
                  onClick: handleQuickSaveSession,
                  disabled: !(currentDiagram && hasUnsavedChanges)
                },
                ...(serverStorageAvailable
                  ? [
                      {
                        id: 'server-storage',
                        label: '服务端图表',
                        onClick: handleOpenServerStorage,
                        tone: 'accent' as const
                      }
                    ]
                  : [])
              ],
              groups: [
                {
                  id: 'apm-architecture',
                  label: 'APM 架构',
                  actions: [
                    {
                      id: 'import-topology',
                      label: '导入服务拓扑',
                      onClick: () => setShowImportDialog(true)
                    },
                    {
                      id: 'save-architecture',
                      label: '保存后台架构',
                      onClick: () => setShowArchitectureSaveDialog(true),
                      tone: 'primary' as const
                    },
                    {
                      id: 'load-architecture',
                      label: '加载后台架构',
                      onClick: () => setShowArchitectureLoadDialog(true)
                    },
                    {
                      id: 'run-view',
                      label: '进入运行视图',
                      onClick: handleOpenRunView,
                      tone: 'success' as const
                    }
                  ]
                }
              ]
            }}
          />
        )}
      </div>

      {architectureError ? (
        <div className="app-architecture-banner" role="alert">
          <div className="app-architecture-banner-text">
            <strong>后台架构同步失败</strong>
            <span>{architectureError}</span>
          </div>
          <button
            type="button"
            onClick={() => setArchitectureError(null)}
            aria-label="关闭同步错误提示"
          >
            关闭
          </button>
        </div>
      ) : null}

      <EditorSessionDialogs
        diagramName={diagramName}
        diagrams={diagrams}
        onCloseExportDialog={handleCloseExportDialog}
        onCloseLoadDialog={handleCloseLoadDialog}
        onCloseSaveDialog={handleCloseSaveDialog}
        onDeleteDiagram={handleDeleteDiagram}
        onDiagramNameChange={setDiagramName}
        onExportDiagram={handleExportDiagram}
        onLoadDiagram={handleLoadDiagram}
        onSaveDiagram={handleSaveDiagram}
        showExportDialog={showExportDialog}
        showLoadDialog={showLoadDialog}
        showSaveDialog={showSaveDialog}
        t={t}
      />

      {showDiagramManager && (
        <DiagramManager
          onClose={handleCloseDiagramManager}
          onLoadDiagram={handleDiagramManagerLoad}
          currentDiagramId={currentDiagram?.id}
          currentDiagramData={currentModel || diagramData}
        />
      )}

      {showStorageManager && (
        <StorageManager onClose={() => setShowStorageManager(false)} />
      )}

      {showImportDialog && (
        <TopologyImportDialog
          onClose={() => setShowImportDialog(false)}
          onImport={handleTopologyImported}
        />
      )}

      {showArchitectureSaveDialog && (
        <BackendArchitectureDialog
          mode="save"
          client={architectureStorage}
          currentId={serverArchitectureId}
          defaultTitle={
            diagramName || (currentModel || diagramData).title || 'MSC 架构'
          }
          diagram={extractSavableData(currentModel || diagramData)}
          onClose={() => setShowArchitectureSaveDialog(false)}
          onSaved={handleArchitectureSaved}
          onLoaded={handleArchitectureLoaded}
        />
      )}

      {showArchitectureLoadDialog && (
        <BackendArchitectureDialog
          mode="load"
          client={architectureStorage}
          currentId={serverArchitectureId}
          defaultTitle={
            diagramName || (currentModel || diagramData).title || 'MSC 架构'
          }
          diagram={extractSavableData(currentModel || diagramData)}
          onClose={() => setShowArchitectureLoadDialog(false)}
          onSaved={handleArchitectureSaved}
          onLoaded={handleArchitectureLoaded}
        />
      )}
    </div>
  );
}
