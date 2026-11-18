import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Isoflow, allLocales, RuntimeOverlay } from 'fossflow';
import {
  RuntimeDataSource,
  ServiceLog,
  TraceDetail,
  TraceSpan
} from '../services/runtime/types';
import { buildRuntimeOverlay } from '../services/runtime/overlayBuilder';
import { resolveDisplayName } from '../services/runtime/nodeNaming';
import {
  loadRuntimeViewConfig,
  saveRuntimeViewConfig
} from '../services/runtime/runtimeViewConfig';
import type { RuntimeViewConfig } from '../services/runtime/runtimeViewConfig';
import { useRuntimeServiceStatus } from '../hooks/useRuntimeServiceStatus';
import { DraggableModal } from './DraggableModal/DraggableModal';
import { RuntimeLogViewer } from './RuntimePanels/RuntimeLogViewer';
import { RuntimeSettings } from './RuntimePanels/RuntimeSettings';
import { TraceWaterfall } from './TraceWaterfall/TraceWaterfall';
import './TopologyRunView.css';

interface Props {
  baseDiagram: any;
  localeKey: keyof typeof allLocales;
  onBackToEditor: () => void;
  dataSource: RuntimeDataSource;
}

type Panel = 'none' | 'overview' | 'trace';
const TRACE_TABS = [
  { id: 'waterfall', label: '调用瀑布图' },
  { id: 'logs', label: '调用日志' }
] as const;
type TraceTab = (typeof TRACE_TABS)[number]['id'];
type TraceSelection = { type: 'span'; span: TraceSpan } | { type: 'log'; log: ServiceLog };
interface TraceLogs {
  trace: TraceDetail;
  entries: ServiceLog[];
  notice?: string;
}

const STATUS_LABEL: Record<string, string> = {
  HEALTHY: '健康',
  WARNING: '告警',
  CRITICAL: '严重',
  OFFLINE: '离线',
  UNKNOWN: '未知'
};

const formatDuration = (ms: number) => {
  if (ms < 1) return '<1 ms';

  return `${Math.round(ms)} ms`;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);

  if (days > 0) return `${days} 天 ${hours} 小时`;

  return `${hours} 小时`;
};

const toTraceSteps = (trace: TraceDetail): TraceSpan[] => {
  return trace.spans.slice().sort((a, b) => a.startMs - b.startMs);
};

const gaugeTone = (value: number) => {
  if (value >= 90) return 'is-critical';
  if (value >= 70) return 'is-warning';

  return '';
};

/* ---------------------------------------------------------------- 图标 */

const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 7h7m4 0h5M4 17h11m4 0h1" strokeLinecap="round" />
    <circle cx="13" cy="7" r="2" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const IconTable = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M9.5 9.5v10" />
  </svg>
);

const IconChain = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M9.5 14.5 14.5 9.5" strokeLinecap="round" />
    <path d="M11 6.5 12.8 4.7a3.5 3.5 0 0 1 4.9 4.9L15.9 11.4" strokeLinecap="round" />
    <path d="M13 17.5l-1.8 1.8a3.5 3.5 0 0 1-4.9-4.9L8.1 12.6" strokeLinecap="round" />
  </svg>
);

const IconLayers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="m12 3.5 8.5 4.6-8.5 4.6L3.5 8.1 12 3.5Z" strokeLinejoin="round" />
    <path d="m3.5 12.4 8.5 4.6 8.5-4.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m3.5 16.4 8.5 4.6 8.5-4.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" strokeLinecap="round" />
  </svg>
);

const IconPlay = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5.5v13l10-6.5-10-6.5Z" />
  </svg>
);

const IconPause = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="7" y="5.5" width="3.6" height="13" rx="1.2" />
    <rect x="13.4" y="5.5" width="3.6" height="13" rx="1.2" />
  </svg>
);

const IconReset = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M4 10a8 8 0 1 1 2.5 7.5" strokeLinecap="round" />
    <path d="M4 4.5V10h5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconBack = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M10 5 4 11.5 10 18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 11.5h16" strokeLinecap="round" />
  </svg>
);

const IconCursor = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="m5 3 6.5 17 2.6-6.4L20.5 11 5 3Z" strokeLinejoin="round" />
  </svg>
);

const IconAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 3.5 21 19.5H3L12 3.5Z" strokeLinejoin="round" />
    <path d="M12 9v4.5M12 16.5h.01" strokeLinecap="round" />
  </svg>
);

const IconNode = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3.2" />
    <circle cx="12" cy="4" r="1.8" />
    <circle cx="12" cy="20" r="1.8" />
    <circle cx="4" cy="12" r="1.8" />
    <circle cx="20" cy="12" r="1.8" />
  </svg>
);

/* ---------------------------------------------------------------- 组件 */

export default function TopologyRunView({
  baseDiagram,
  localeKey,
  onBackToEditor,
  dataSource
}: Props) {
  const [traceInput, setTraceInput] = useState('');
  const [activeTrace, setActiveTrace] = useState<TraceDetail | null>(null);
  const [traceTab, setTraceTab] = useState<TraceTab>('waterfall');
  const traceTabsId = useId();
  const [traceError, setTraceError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [traceLogs, setTraceLogs] = useState<TraceLogs | null>(null);
  const [panel, setPanel] = useState<Panel>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState(() => loadRuntimeViewConfig());
  const [revealRatio, setRevealRatio] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);
  const [traceSelection, setTraceSelection] = useState<TraceSelection | null>(null);

  const traceRequest = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const diagramItems = useMemo(() => {
    return (baseDiagram?.items ?? []) as Array<{
      id: string;
      name?: string;
      tag?: string;
      description?: string;
    }>;
  }, [baseDiagram?.items]);

  const currentView = useMemo(() => {
    return (baseDiagram?.views?.[0] ?? null) as {
      items?: Array<{ id: string }>;
      connectors?: Array<{ id: string; anchors?: Array<{ ref?: { item?: string } }> }>;
    } | null;
  }, [baseDiagram?.views]);

  /** 占位名统一替换为「节点 N」，只影响运行视图展示。 */
  const displayNameById = useMemo(() => {
    const map = new Map<string, string>();

    diagramItems.forEach((item, index) => {
      map.set(item.id, resolveDisplayName(item, index));
    });

    return map;
  }, [diagramItems]);

  /**
   * Isoflow reloads its model whenever `initialData` changes identity, and a
   * failed reload leaves the canvas blank, so this reference must stay stable
   * across renders.
   */
  const runtimeInitialData = useMemo(() => {
    const items = (baseDiagram?.items ?? []).map((item: any) => {
      const displayName = displayNameById.get(item.id);

      return displayName && displayName !== item.name
        ? { ...item, name: displayName }
        : item;
    });

    return { ...baseDiagram, items, fitToView: true };
  }, [baseDiagram, displayNameById]);

  const services = useRuntimeServiceStatus(dataSource, diagramItems, config.nodeStatusRefreshSeconds);

  const serviceById = useMemo(() => {
    return new Map(services.map((service) => [service.itemId, service]));
  }, [services]);

  const selectedService = selectedItemId ? serviceById.get(selectedItemId) : undefined;
  const selectedName = selectedItemId
    ? displayNameById.get(selectedItemId) ?? '节点详情'
    : '节点详情';

  useEffect(() => {
    if (!activeTrace) return;
    let cancelled = false;
    const itemIds = Array.from(new Set(activeTrace.spans.map((span) => span.itemId)));

    Promise.allSettled(
      itemIds.map(async (itemId) =>
        dataSource.getServiceLogs({ itemId, traceId: activeTrace.traceId, limit: 40 })
      )
    ).then((results) => {
      if (cancelled) return;

      const entries: ServiceLog[] = [];
      let failed = 0;
      for (const result of results) {
        if (result.status === 'rejected') {
          failed += 1;
          continue;
        }

        entries.push(...result.value.filter((log) => !log.traceId || log.traceId === activeTrace.traceId));
      }
      entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      const notice = failed > 0
        ? (failed === results.length ? '调用日志加载失败' : '部分节点的日志加载失败')
        : undefined;
      setTraceLogs({ trace: activeTrace, entries, notice });
    });

    return () => {
      cancelled = true;
    };
  }, [activeTrace, dataSource]);

  const traceSteps = useMemo(() => {
    if (!activeTrace) return [];

    return toTraceSteps(activeTrace);
  }, [activeTrace]);

  const logSourceNames = useMemo(() => {
    return new Map(
      traceSteps.map(({ itemId, serviceName }) => [itemId, displayNameById.get(itemId) ?? serviceName])
    );
  }, [displayNameById, traceSteps]);
  const loadedTraceLogs = traceLogs?.trace === activeTrace ? traceLogs : null;
  const traceItemId = traceSelection?.type === 'log'
    ? traceSelection.log.itemId
    : traceSelection?.span.itemId;
  const focusedItemId = panel === 'trace' ? traceItemId : selectedItemId;
  const traceOnCanvas = panel === 'trace' ? activeTrace : null;
  const canvasRevealRatio = traceOnCanvas ? revealRatio : 1;

  useEffect(() => {
    if (panel !== 'trace') {
      if (isPlaying) setIsPlaying(false);
      return;
    }
    if (!isPlaying) return;

    const timer = window.setInterval(() => {
      setRevealRatio((previous) => {
        const next = previous + 0.08;

        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }

        return next;
      });
    }, 260);

    return () => window.clearInterval(timer);
  }, [isPlaying, panel]);

  const runtimeOverlay = useMemo<RuntimeOverlay>(() => {
    return {
      ...buildRuntimeOverlay({
        trace: traceOnCanvas,
        services,
        view: currentView,
        selectedItemId: focusedItemId,
        revealRatio: canvasRevealRatio,
        showHealth: config.showNodeHealth
      }),
      statusLabels: STATUS_LABEL
    };
  }, [
    canvasRevealRatio,
    config.showNodeHealth,
    currentView,
    focusedItemId,
    services,
    traceOnCanvas
  ]);

  const summary = useMemo(() => {
    const total = services.length;
    const unhealthy = services.filter(
      (service) => service.status === 'CRITICAL' || service.status === 'OFFLINE'
    ).length;
    const warning = services.filter((service) => service.status === 'WARNING').length;
    const avgLatency =
      total > 0
        ? services.reduce((acc, service) => acc + service.metrics.latencyP95Ms, 0) / total
        : 0;

    return { total, unhealthy, warning, avgLatency };
  }, [services]);

  /* ---- 交互 ---- */

  const closePanel = useCallback(() => {
    setPanel('none');
    panelTriggerRef.current?.focus();
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    menuTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsidePointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer);

    return () => document.removeEventListener('pointerdown', handleOutsidePointer);
  }, [menuOpen]);

  const updateConfig = (nextConfig: RuntimeViewConfig) => {
    setConfig(nextConfig);
    saveRuntimeViewConfig(nextConfig);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (menuOpen) {
        event.stopPropagation();
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
        return;
      }

      if (settingsOpen) {
        event.stopPropagation();
        closeSettings();
        return;
      }

      if (panel !== 'none') {
        event.stopPropagation();
        closePanel();
        return;
      }

      if (legendOpen) {
        event.stopPropagation();
        setLegendOpen(false);
        return;
      }

      if (selectedItemId) setSelectedItemId(null);
    };

    window.addEventListener('keydown', onKeyDown, true);

    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closePanel, closeSettings, legendOpen, menuOpen, panel, selectedItemId, settingsOpen]);

  const openPanel = (next: Exclude<Panel, 'none'>, trigger = menuTriggerRef.current) => {
    panelTriggerRef.current = trigger;
    setMenuOpen(false);
    setLegendOpen(false);
    setSelectedItemId(null);
    setPanel(next);
  };

  const handleRuntimeAction = (data: { item?: { id?: string } }) => {
    const itemId = data?.item?.id;

    if (!itemId) return;

    setSelectedItemId(itemId);
    setPanel('none');
  };

  const handleTraceQuery = async () => {
    if (isLoadingTrace) return;
    const traceId = traceInput.trim();

    if (!traceId) {
      setTraceError('请输入 TraceId');
      return;
    }

    const request = ++traceRequest.current;
    setTraceError(null);
    setActiveTrace(null);
    setTraceLogs(null);
    setTraceSelection(null);
    setIsPlaying(false);
    setIsLoadingTrace(true);

    try {
      const result = await dataSource.getTrace(traceId);
      if (request !== traceRequest.current) return;

      if (!result) {
        setTraceError(`未找到 TraceId: ${traceId}`);
        return;
      }

      setActiveTrace(result);
      setRevealRatio(0);
      setIsPlaying(true);
    } catch (error) {
      if (request === traceRequest.current) {
        setTraceError(error instanceof Error ? error.message : '查询失败');
      }
    } finally {
      if (request === traceRequest.current) setIsLoadingTrace(false);
    }
  };

  const handleReset = () => {
    traceRequest.current += 1;
    setIsLoadingTrace(false);
    setActiveTrace(null);
    setTraceTab('waterfall');
    setTraceLogs(null);
    setTraceError(null);
    setSelectedItemId(null);
    setTraceInput('');
    setRevealRatio(1);
    setIsPlaying(false);
    setTraceSelection(null);
  };

  const focusNode = (itemId: string) => {
    setSelectedItemId(itemId);
    setPanel('none');
  };

  const handleSelectSpan = (span: TraceSpan) => {
    setTraceSelection({ type: 'span', span });
  };

  const handleSelectLog = useCallback((log: ServiceLog | null) => {
    setTraceSelection((selection) => {
      if (!log) return null;
      if (selection?.type === 'log' && selection.log === log) return selection;
      return { type: 'log', log };
    });
  }, []);

  const togglePlayback = () => {
    if (revealRatio >= 1) setRevealRatio(0);
    setIsPlaying((value) => !value);
  };

  const alertCount = summary.unhealthy + summary.warning;

  return (
    <div className="rt-map">
      {/* 地图铺满视口 */}
      <div className="rt-map-canvas">
        <Isoflow
          initialData={runtimeInitialData}
          editorMode="EXPLORABLE_READONLY"
          locale={allLocales[localeKey]}
          isRuntime={true}
          onRuntimeActionEvent={handleRuntimeAction}
          runtimeOverlay={runtimeOverlay}
          runtimeToolbarExtra={
            <button
              type="button"
              className="rt-legend-toggle"
              onClick={() => setLegendOpen((open) => !open)}
              aria-expanded={legendOpen}
              aria-controls="runtime-legend"
              title="图例"
              aria-label="图例"
            >
              <IconLayers />
            </button>
          }
        />
      </div>

      <div
        className="rt-main-menu"
        ref={menuRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
        }}
      >
        <button
          type="button"
          className="rt-menu-trigger"
          ref={menuTriggerRef}
          aria-label="主菜单"
          aria-expanded={menuOpen}
          aria-controls="runtime-main-menu"
          onClick={() => {
            setMenuOpen((open) => !open);
            setLegendOpen(false);
          }}
        >
          <IconMenu />
        </button>
        <nav
          id="runtime-main-menu"
          className="rt-menu-items"
          aria-label="运行视图菜单"
          hidden={!menuOpen}
        >
          <button type="button" className="rt-hud-btn" onClick={() => openPanel('overview')}>
            <IconTable /> 服务概览
          </button>
          <button
            type="button"
            className="rt-hud-btn"
            aria-haspopup="dialog"
            onClick={() => openPanel('trace')}
          >
            <IconChain /> 调用链路
          </button>
          <button type="button" className="rt-hud-btn" onClick={onBackToEditor}>
            <IconBack /> 返回编辑
          </button>
          <hr className="rt-menu-divider" />
          <button
            type="button"
            className="rt-hud-btn"
            aria-haspopup="dialog"
            onClick={() => {
              setMenuOpen(false);
              setLegendOpen(false);
              setSettingsOpen(true);
            }}
          >
            <IconSettings /> 设置
          </button>
        </nav>
      </div>

      <div className="rt-legend" id="runtime-legend" hidden={!legendOpen}>
        {legendOpen ? (
          <div className="rt-legend-card">
            <div className="rt-legend-head">
              <span>图层与显示</span>
              <button
                className="rt-icon-btn"
                onClick={() => setLegendOpen(false)}
                aria-label="关闭图例"
              >
                <IconClose />
              </button>
            </div>

            <div className="rt-legend-list">
              {(
                [
                  ['is-healthy', '健康'],
                  ['is-warning', '告警'],
                  ['is-critical', '严重'],
                  ['is-offline', '离线']
                ] as const
              ).map(([tone, label]) => (
                <span key={tone} className="rt-legend-item">
                  <span className={`rt-swatch ${tone}`} />
                  {label}
                </span>
              ))}
            </div>

            <label className="rt-switch-row">
              <span>节点显示健康状态</span>
              <input
                type="checkbox"
                className="rt-switch"
                checked={config.showNodeHealth}
                onChange={(event) => updateConfig({ ...config, showNodeHealth: event.target.checked })}
              />
            </label>

            <div className="rt-legend-foot">
              健康状态展示在节点名称旁，可随时关闭；蓝色流线表示调用链路。
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={['rt-hud-btn', 'rt-map-health', alertCount > 0 ? 'is-alert' : 'is-ok'].join(' ')}
        onClick={(event) => openPanel('overview', event.currentTarget)}
        aria-haspopup="dialog"
      >
        <span className="rt-hud-dot" />
        {alertCount > 0 ? `${alertCount} 项异常` : services.length > 0 ? '全部健康' : '暂无状态'}
      </button>

      {/* 底部状态条 */}
      <div className="rt-statusbar">
        <span>
          <b>{summary.total}</b> 服务
        </span>
        <span className="rt-divider" />
        <span>
          <b>{currentView?.connectors?.length ?? 0}</b> 链路
        </span>
        <span className="rt-divider" />
        <span>
          平均 P95 <b>{summary.total > 0 ? formatDuration(summary.avgLatency) : '—'}</b>
        </span>
      </div>

      {/* 节点详情随画布上的选择更新。 */}
      {selectedItemId ? (
        <DraggableModal
          title={selectedName}
          allowCanvasInteraction
          icon={<IconNode />}
          width={392}
          onClose={() => setSelectedItemId(null)}
          badge={selectedService && (
            <span
              className={`rt-pill rt-pill-${selectedService.status.toLowerCase()}`}
            >
              {STATUS_LABEL[selectedService.status] ?? selectedService.status}
            </span>
          )}
        >
          {selectedService ? (
            <div className="rt-detail">
              <div className="rt-detail-meta">
                <span className="rt-mono">{selectedService.instance ?? '--'}</span>
                <span className="rt-divider" />
                <span>{selectedService.region ?? '--'}</span>
              </div>

              <div className="rt-gauges">
                <div className="rt-gauge">
                  <div className="rt-gauge-head">
                    <span>CPU</span>
                    <strong>{selectedService.metrics.cpu}%</strong>
                  </div>
                  <div className="rt-gauge-track">
                    <div
                      className={`rt-gauge-fill ${gaugeTone(selectedService.metrics.cpu)}`}
                      style={{ width: `${Math.min(100, selectedService.metrics.cpu)}%` }}
                    />
                  </div>
                </div>
                <div className="rt-gauge">
                  <div className="rt-gauge-head">
                    <span>内存</span>
                    <strong>{selectedService.metrics.memory}%</strong>
                  </div>
                  <div className="rt-gauge-track">
                    <div
                      className={`rt-gauge-fill ${gaugeTone(selectedService.metrics.memory)}`}
                      style={{ width: `${Math.min(100, selectedService.metrics.memory)}%` }}
                    />
                  </div>
                </div>
              </div>

              <dl className="rt-facts">
                <div>
                  <dt>版本</dt>
                  <dd className="rt-mono">{selectedService.version ?? '--'}</dd>
                </div>
                <div>
                  <dt>运行时长</dt>
                  <dd>{formatUptime(selectedService.metrics.uptimeSeconds)}</dd>
                </div>
                <div>
                  <dt>P95 延迟</dt>
                  <dd>{formatDuration(selectedService.metrics.latencyP95Ms)}</dd>
                </div>
                <div>
                  <dt>QPS</dt>
                  <dd>{selectedService.metrics.qps}</dd>
                </div>
                <div>
                  <dt>错误率</dt>
                  <dd>{selectedService.metrics.errorRate}%</dd>
                </div>
                <div>
                  <dt>最近心跳</dt>
                  <dd>
                    {selectedService.lastHeartbeat
                      ? new Date(selectedService.lastHeartbeat).toLocaleTimeString()
                      : '--'}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rt-empty" role="status">暂无节点指标</div>
          )}
        </DraggableModal>
      ) : null}

      {/* 服务概览 */}
      {panel === 'overview' ? (
        <DraggableModal
          title="服务概览"
          icon={<IconTable />}
          width={860}
          onClose={closePanel}
          badge={<span className="rt-chip">{summary.total} 个节点</span>}
        >
          <div className="rt-stats">
            <div className={`rt-stat ${summary.unhealthy > 0 ? 'is-critical' : ''}`}>
              <span>异常服务</span>
              <strong>{summary.unhealthy}</strong>
            </div>
            <div className={`rt-stat ${summary.warning > 0 ? 'is-warning' : ''}`}>
              <span>告警服务</span>
              <strong>{summary.warning}</strong>
            </div>
            <div className="rt-stat">
              <span>平均 P95</span>
              <strong>
                {Math.round(summary.avgLatency)}
                <em>ms</em>
              </strong>
            </div>
            <div className="rt-stat">
              <span>调用链路</span>
              <strong>{currentView?.connectors?.length ?? 0}</strong>
            </div>
          </div>

          <div className="rt-table-wrap">
            <table className="rt-table">
              <thead>
                <tr>
                  <th>服务</th>
                  <th>状态</th>
                  <th className="is-num">CPU</th>
                  <th className="is-num">内存</th>
                  <th className="is-num">P95</th>
                  <th className="is-num">QPS</th>
                  <th className="is-num">错误率</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr
                    key={service.itemId}
                    onClick={() => focusNode(service.itemId)}
                    className={selectedItemId === service.itemId ? 'is-selected' : ''}
                  >
                    <td>
                      <span className="rt-table-name">
                        {displayNameById.get(service.itemId) ?? service.name}
                      </span>
                      <span className="rt-table-sub rt-mono">
                        {service.instance ?? '--'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`rt-pill rt-pill-${service.status.toLowerCase()}`}
                      >
                        {STATUS_LABEL[service.status] ?? service.status}
                      </span>
                    </td>
                    <td className="is-num">{service.metrics.cpu}%</td>
                    <td className="is-num">{service.metrics.memory}%</td>
                    <td className="is-num">
                      {formatDuration(service.metrics.latencyP95Ms)}
                    </td>
                    <td className="is-num">{service.metrics.qps}</td>
                    <td className="is-num">{service.metrics.errorRate}%</td>
                  </tr>
                ))}
                {services.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="rt-table-empty">
                      暂无服务数据
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </DraggableModal>
      ) : null}

      {/* 调用链路 */}
      {panel === 'trace' ? (
        <DraggableModal
          title="调用链路"
          placement="top-right"
          allowCanvasInteraction
          bodyClassName="rt-trace-body"
          icon={<IconChain />}
          width={680}
          onClose={closePanel}
          badge={
            activeTrace ? (
              <span className="rt-chip rt-chip-live">{traceSteps.length} Span</span>
            ) : null
          }
        >
          <div className="rt-query rt-trace-query">
            <div className="rt-query-field">
              <IconSearch />
              <input
                placeholder="输入 TraceId，例如 trace-order-create"
                value={traceInput}
                onChange={(event) => setTraceInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleTraceQuery();
                }}
                aria-label="TraceId"
                autoFocus
              />
            </div>
            <button
              className="rt-btn rt-btn-primary"
              onClick={handleTraceQuery}
              disabled={isLoadingTrace}
            >
              {isLoadingTrace ? '查询中…' : '查询'}
            </button>
            <button
              className="rt-btn rt-btn-ghost rt-icon-only"
              onClick={handleReset}
              title="重置"
              aria-label="重置"
            >
              <IconReset />
            </button>
          </div>

          {traceError ? (
            <div className="rt-alert" role="alert">
              <IconAlert />
              <span>{traceError}</span>
            </div>
          ) : null}

          {activeTrace ? (
            <>
              <div
                className="rt-trace-tabs"
                role="tablist"
                aria-label="链路详情"
                onKeyDown={(event) => {
                  const { key } = event;
                  if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
                  event.preventDefault();
                  const next = key === 'Home' || (key !== 'End' && traceTab === 'logs') ? 'waterfall' : 'logs';
                  setTraceTab(next);
                  event.currentTarget.querySelector<HTMLButtonElement>(`[data-trace-tab="${next}"]`)?.focus();
                }}
              >
                {TRACE_TABS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    id={`${traceTabsId}-tab-${id}`}
                    data-trace-tab={id}
                    aria-selected={traceTab === id}
                    aria-controls={`${traceTabsId}-panel-${id}`}
                    tabIndex={traceTab === id ? 0 : -1}
                    onClick={() => setTraceTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div
                className="rt-trace-pane"
                role="tabpanel"
                id={`${traceTabsId}-panel-waterfall`}
                aria-labelledby={`${traceTabsId}-tab-waterfall`}
                hidden={traceTab !== 'waterfall'}
                tabIndex={0}
              >
                <div className="rt-playback">
                  <button
                    className="rt-btn rt-btn-ghost rt-icon-only"
                    onClick={togglePlayback}
                    title={isPlaying ? '暂停回放' : '播放回放'}
                  >
                    {isPlaying ? <IconPause /> : <IconPlay />}
                  </button>
                  <input
                    className="rt-range"
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(revealRatio * 100)}
                    onChange={(event) => {
                      setIsPlaying(false);
                      setRevealRatio(Number(event.target.value) / 100);
                    }}
                    aria-label="回放进度"
                  />
                  <span className="rt-playback-value">
                    {Math.round(revealRatio * 100)}%
                  </span>
                  <span className="rt-divider" />
                  <span className="rt-mono rt-muted">
                    总耗时 {formatDuration(activeTrace.totalDurationMs)}
                  </span>
                </div>

                <TraceWaterfall
                  trace={activeTrace}
                  revealRatio={revealRatio}
                  activeSpanId={traceSelection?.type === 'span' ? traceSelection.span.spanId : null}
                  onSelectSpan={handleSelectSpan}
                />
              </div>

              <div
                className="rt-trace-pane rt-trace-logs"
                role="tabpanel"
                id={`${traceTabsId}-panel-logs`}
                aria-labelledby={`${traceTabsId}-tab-logs`}
                hidden={traceTab !== 'logs'}
                tabIndex={0}
              >
                <RuntimeLogViewer
                  key={activeTrace.traceId}
                  entries={loadedTraceLogs?.entries ?? []}
                  sourceNames={logSourceNames}
                  selectedLog={traceSelection?.type === 'log' ? traceSelection.log : null}
                  onSelect={handleSelectLog}
                  colors={config.logColors}
                  loading={!loadedTraceLogs}
                  notice={loadedTraceLogs?.notice}
                />
              </div>
            </>
          ) : (
            <div className="rt-empty rt-empty-tall">
              <span className="rt-empty-icon">
                <IconCursor />
              </span>
              <strong>等待 TraceId 查询</strong>
              <p>查询后这里按调用顺序展示服务、Span 与耗时，并在地图上高亮链路。</p>
            </div>
          )}
        </DraggableModal>
      ) : null}
      {settingsOpen && (
        <RuntimeSettings config={config} onChange={updateConfig} onClose={closeSettings} />
      )}
    </div>
  );
}
