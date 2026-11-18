import { useCallback, useEffect, useMemo, useState } from 'react';
import { DiagramData } from '../diagramUtils';
import { SavedDiagram } from '../types/editor';
import { useIconPackManager } from '../services/iconPackManagerV2';
import { sanitizeDiagram } from '../services/diagramSanitizer';
import { architectureStorage } from '../services/architectureStorage';

export type ArchitectureLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

const LAST_OPENED_ID_KEY = 'fossflow-last-opened';
const LAST_OPENED_DATA_KEY = 'fossflow-last-opened-data';
const DIAGRAMS_KEY = 'fossflow-diagrams';

export const DEFAULT_COLORS = [
  { id: 'blue', value: '#0066cc' },
  { id: 'green', value: '#00aa00' },
  { id: 'red', value: '#cc0000' },
  { id: 'orange', value: '#ff9900' },
  { id: 'purple', value: '#9900cc' },
  { id: 'black', value: '#000000' },
  { id: 'gray', value: '#666666' }
];

const emptyDiagram = (): DiagramData => ({
  title: 'Untitled Diagram',
  icons: [],
  colors: DEFAULT_COLORS,
  items: [],
  views: [],
  fitToScreen: true
});

const readCachedDiagram = (): DiagramData => {
  try {
    const raw = localStorage.getItem(LAST_OPENED_DATA_KEY);

    if (!raw) return emptyDiagram();

    const parsed = JSON.parse(raw);

    return {
      ...parsed,
      icons: parsed.icons ?? [],
      colors: parsed.colors?.length ? parsed.colors : DEFAULT_COLORS,
      fitToScreen: parsed.fitToScreen !== false
    } as DiagramData;
  } catch {
    return emptyDiagram();
  }
};

const readSavedDiagramById = (diagramId: string): DiagramData | null => {
  try {
    const raw = localStorage.getItem(DIAGRAMS_KEY);

    if (!raw) return null;

    const list = JSON.parse(raw) as SavedDiagram[];
    const match = list.find((diagram) => diagram.id === diagramId);

    return match ? (match.data as DiagramData) : null;
  } catch {
    return null;
  }
};

/**
 * 两个页面共用的图表数据来源。
 *
 * 数据优先级：
 * 1. 携带 `architectureId` 时只认后台最新架构 —— 本地缓存可能是旧版本，
 *    加载失败必须显式报错，不能静默回退（否则会以为改的东西没生效）。
 * 2. 否则按 diagramId / 最近打开的本地缓存恢复。
 */
export const useDiagramSource = (
  diagramId?: string | null,
  architectureId?: string | null
) => {
  const iconPackManager = useIconPackManager();

  const [diagramData, setDiagramData] = useState<DiagramData>(() => {
    const fromSaved = diagramId ? readSavedDiagramById(diagramId) : null;

    return fromSaved ?? readCachedDiagram();
  });

  const [serverDiagram, setServerDiagram] = useState<DiagramData | null>(null);
  const [architectureStatus, setArchitectureStatus] =
    useState<ArchitectureLoadStatus>('idle');
  const [architectureError, setArchitectureError] = useState<string | null>(null);
  const [architectureReloadKey, setArchitectureReloadKey] = useState(0);

  const reloadArchitecture = useCallback(() => {
    setArchitectureReloadKey((previous) => previous + 1);
  }, []);

  useEffect(() => {
    if (!architectureId) {
      setServerDiagram(null);
      setArchitectureStatus('idle');
      setArchitectureError(null);

      return;
    }

    let cancelled = false;

    setArchitectureStatus('loading');
    setArchitectureError(null);

    architectureStorage
      .load(architectureId)
      .then((record) => {
        if (cancelled) return;

        setServerDiagram(record.diagram);
        setArchitectureStatus('ready');
      })
      .catch((error) => {
        if (cancelled) return;

        setArchitectureError(
          error instanceof Error ? error.message : '加载后台架构失败'
        );
        setArchitectureStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [architectureId, architectureReloadKey]);

  // 图标包加载完成后，把可用图标并入本地图表（后台图在下方统一合并）
  useEffect(() => {
    const loadedIcons = iconPackManager.loadedIcons;

    if (loadedIcons.length === 0) return;

    setDiagramData((previous) => {
      const byId = new Map<string, any>();

      (previous.icons ?? []).forEach((icon) => byId.set(icon.id, icon));
      loadedIcons.forEach((icon) => byId.set(icon.id, icon));

      const merged = Array.from(byId.values());

      return merged.length === (previous.icons ?? []).length
        ? previous
        : { ...previous, icons: merged };
    });
  }, [iconPackManager.loadedIcons]);

  const sourceDiagram =
    architectureId && serverDiagram ? serverDiagram : architectureId ? emptyDiagram() : diagramData;

  /**
   * 校验并修复图元引用，避免运行视图因数据腐化而空白。
   */
  const sanitizedDiagram = useMemo<DiagramData>(() => {
    const withIcons = {
      ...sourceDiagram,
      icons: [
        ...(sourceDiagram.icons ?? []),
        ...iconPackManager.loadedIcons.filter(
          (icon) => !(sourceDiagram.icons ?? []).some((own) => own.id === icon.id)
        )
      ]
    };

    const { data, changes } = sanitizeDiagram(withIcons);

    if (changes.length > 0) {
      console.warn('[fossflow] repaired diagram', changes);
    }

    return data as DiagramData;
  }, [sourceDiagram, iconPackManager.loadedIcons]);

  const persistLastOpened = useCallback((data: DiagramData, id?: string) => {
    try {
      if (id) localStorage.setItem(LAST_OPENED_ID_KEY, id);

      localStorage.setItem(LAST_OPENED_DATA_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist diagram:', error);
    }
  }, []);

  return {
    diagramData: sourceDiagram,
    setDiagramData,
    sanitizedDiagram,
    iconPackManager,
    persistLastOpened,
    architectureStatus,
    architectureError,
    reloadArchitecture
  };
};
