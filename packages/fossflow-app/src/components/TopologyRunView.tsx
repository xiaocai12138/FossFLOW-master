import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Isoflow, allLocales, RuntimeOverlay } from 'fossflow';
import {
  RuntimeDataSource,
  ServiceLog,
  ServiceState,
  TraceDetail,
  TraceSpan
} from '../services/runtime/types';
import { buildRuntimeOverlay } from '../services/runtime/overlayBuilder';
import { resolveDisplayName } from '../services/runtime/nodeNaming';
import {
  loadRuntimeViewConfig,
  saveRuntimeViewConfig
} from '../services/runtime/runtimeViewConfig';
import { DraggableModal } from './DraggableModal/DraggableModal';
import './TopologyRunView.css';

interface Props {
  baseDiagram: any;
  localeKey: keyof typeof allLocales;
  onBackToEditor: () => void;
  dataSource: RuntimeDataSource;
}

type Panel = 'none' | 'overview' | 'trace';

const STATUS_LABEL: Record<string, string> = {
  HEALTHY: '健康',
  WARNING: '告警',
  CRITICAL: '严重',
  OFFLINE: '离线',
  UNKNOWN: '未知'
};

const LEVEL_ORDER: Record<string, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
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

const IconTopology = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
    <path d="M6.5 10v4a3.5 3.5 0 0 0 3.5 3.5h4" strokeLinecap="round" />
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

const IconLog = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
    <path d="M8 8.5h8M8 12.5h8M8 16.5h5" strokeLinecap="round" />
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
  const [services, setServices] = useState<ServiceState[]>([]);
  const [traceInput, setTraceInput] = useState('');
  const [activeTrace, setActiveTrace] = useState<TraceDetail | null>(null);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ServiceLog[]>([]);
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>(
    'ALL'
  );
  const [panel, setPanel] = useState<Panel>('none');
  const [legendOpen, setLegendOpen] = useState(false);
  const [config, setConfig] = useState(() => loadRuntimeViewConfig());
  const [revealRatio, setRevealRatio] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingTrace, setIsLoadingTrace] = useState(false);

  const playTimer = useRef<number | null>(null);

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

    return { ...baseDiagram, items, fitToScreen: true };
  }, [baseDiagram, displayNameById]);

  useEffect(() => {
    let cancelled = false;

    dataSource
      .listServices(diagramItems.map((item) => ({ id: item.id, name: item.name })))
      .then((result) => {
        if (!cancelled) setServices(result);
      })
      .catch(() => {
        if (!cancelled) setServices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [dataSource, diagramItems]);

  const serviceById = useMemo(() => {
    return new Map(services.map((service) => [service.itemId, service]));
  }, [services]);

  const selectedService = selectedItemId ? serviceById.get(selectedItemId) : undefined;
  const selectedName = selectedItemId
    ? displayNameById.get(selectedItemId) ?? '节点详情'
    : '节点详情';

  useEffect(() => {
    if (!selectedItemId) {
      setLogs([]);
      return;
    }

    let cancelled = false;

    dataSource
      .getServiceLogs({
        itemId: selectedItemId,
        traceId: activeTrace?.traceId,
        limit: 40
      })
      .then((result) => {
        if (!cancelled) setLogs(result);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTrace?.traceId, dataSource, selectedItemId]);

  const traceSteps = useMemo(() => {
    if (!activeTrace) return [];

    return toTraceSteps(activeTrace);
  }, [activeTrace]);

  useEffect(() => {
    if (!isPlaying) {
      if (playTimer.current !== null) {
        window.clearInterval(playTimer.current);
        playTimer.current = null;
      }

      return;
    }

    playTimer.current = window.setInterval(() => {
      setRevealRatio((previous) => {
        const next = previous + 0.08;

        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }

        return next;
      });
    }, 260);

    return () => {
      if (playTimer.current !== null) {
        window.clearInterval(playTimer.current);
        playTimer.current = null;
      }
    };
  }, [isPlaying]);

  const runtimeOverlay = useMemo<RuntimeOverlay>(() => {
    return {
      ...buildRuntimeOverlay({
        trace: activeTrace,
        services,
        view: currentView,
        selectedItemId,
        revealRatio: activeTrace ? revealRatio : 1,
        showHealth: config.showNodeHealth
      }),
      statusLabels: STATUS_LABEL
    };
  }, [
    activeTrace,
    config.showNodeHealth,
    currentView,
    revealRatio,
    selectedItemId,
    services
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

  const filteredLogs = useMemo(() => {
    if (levelFilter === 'ALL') return logs;

    return logs.filter((log) => {
      return LEVEL_ORDER[log.level] >= LEVEL_ORDER[levelFilter];
    });
  }, [levelFilter, logs]);

  /* ---- 交互 ---- */

  const closePanel = useCallback(() => setPanel('none'), []);

  const toggleHealth = (next: boolean) => {
    const nextConfig = { ...config, showNodeHealth: next };

    setConfig(nextConfig);
    saveRuntimeViewConfig(nextConfig);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (panel !== 'none') {
        setPanel('none');
        return;
      }

      if (legendOpen) {
        setLegendOpen(false);
        return;
      }

      if (selectedItemId) setSelectedItemId(null);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [legendOpen, panel, selectedItemId]);

  const handleRuntimeAction = (data: { item?: { id?: string } }) => {
    const itemId = data?.item?.id;

    if (!itemId) return;

    setSelectedItemId(itemId);
    setPanel('none');
  };

  const handleTraceQuery = async () => {
    const traceId = traceInput.trim();

    if (!traceId) {
      setTraceError('请输入 TraceId');
      return;
    }

    setTraceError(null);
    setIsLoadingTrace(true);

    try {
      const result = await dataSource.getTrace(traceId);

      if (!result) {
        setActiveTrace(null);
        setTraceError(`未找到 TraceId: ${traceId}`);
        return;
      }

      setActiveTrace(result);
      setRevealRatio(0);
      setIsPlaying(true);
    } catch (error) {
      setTraceError(error instanceof Error ? error.message : '查询失败');
    } finally {
      setIsLoadingTrace(false);
    }
  };

  const handleReset = () => {
    setActiveTrace(null);
    setTraceError(null);
    setSelectedItemId(null);
    setTraceInput('');
    setRevealRatio(1);
    setIsPlaying(false);
  };

  const focusNode = (itemId: string) => {
    setSelectedItemId(itemId);
    setPanel('none');
  };

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
        />
      </div>

      {/* 顶部 HUD */}
      <header className="rt-hud rt-hud-top">
        <div className="rt-brand">
          <span className="rt-brand-mark">
            <IconTopology />
          </span>
          <div className="rt-brand-text">
            <strong>DevOps 运行视图</strong>
            <span>架构拓扑与调用链路</span>
          </div>
          <span className="rt-env">RUNTIME</span>
        </div>

        <div className="rt-hud-actions">
          <button
            className={['rt-hud-btn', alertCount > 0 ? 'is-alert' : 'is-ok'].join(' ')}
            onClick={() => setPanel('overview')}
            title="服务概览"
          >
            <span className="rt-hud-dot" />
            {alertCount > 0 ? `${alertCount} 项异常` : '全部健康'}
          </button>

          <button
            className="rt-hud-btn"
            onClick={() => setPanel('overview')}
            title="服务清单"
          >
            <IconTable />
            概览
          </button>

          <button
            className={['rt-hud-btn', activeTrace ? 'is-live' : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPanel('trace')}
            title="调用链路"
          >
            <IconChain />
            调用链路
          </button>

          <button className="rt-hud-btn" onClick={onBackToEditor} title="返回编辑模式">
            <IconBack />
            编辑
          </button>
        </div>
      </header>

      {/* 图例与显示配置 */}
      <div className="rt-legend">
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
                onChange={(event) => toggleHealth(event.target.checked)}
              />
            </label>

            <div className="rt-legend-foot">
              健康状态展示在节点名称旁，可随时关闭；蓝色流线表示调用链路。
            </div>
          </div>
        ) : null}

        <button
          className="rt-hud-btn rt-legend-toggle"
          onClick={() => setLegendOpen((open) => !open)}
          aria-expanded={legendOpen}
          title="图层图例"
        >
          <IconLayers />
          图例
        </button>
      </div>

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
          平均 P95 <b>{formatDuration(summary.avgLatency)}</b>
        </span>
        {activeTrace ? (
          <>
            <span className="rt-divider" />
            <span className="rt-statusbar-live">
              {activeTrace.traceId} · {traceSteps.length} Span
            </span>
          </>
        ) : null}
      </div>

      {/* 节点详情（可拖动模态框） */}
      {selectedService ? (
        <DraggableModal
          title={selectedName}
          icon={<IconNode />}
          width={392}
          onClose={() => setSelectedItemId(null)}
          badge={
            <span
              className={`rt-pill rt-pill-${selectedService.status.toLowerCase()}`}
            >
              {STATUS_LABEL[selectedService.status] ?? selectedService.status}
            </span>
          }
        >
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

            <div className="rt-log-head">
              <h3>
                <IconLog /> 调用日志
              </h3>
              <div className="rt-segmented">
                {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((level) => (
                  <button
                    key={level}
                    className={[
                      'rt-segment',
                      levelFilter === level ? 'is-active' : ''
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setLevelFilter(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div className="rt-logs">
              {filteredLogs.length === 0 ? (
                <div className="rt-empty">
                  <span>暂无匹配日志</span>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="rt-log">
                    <span
                      className={`rt-log-level rt-log-level-${log.level.toLowerCase()}`}
                    >
                      {log.level}
                    </span>
                    <div className="rt-log-body">
                      <span className="rt-log-time">
                        {new Date(log.timestamp).toLocaleTimeString()}
                        {log.traceId ? ` · ${log.traceId}` : ''}
                      </span>
                      <p>{log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
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
          icon={<IconChain />}
          width={560}
          onClose={closePanel}
          badge={
            activeTrace ? (
              <span className="rt-chip rt-chip-live">{traceSteps.length} Span</span>
            ) : null
          }
        >
          <div className="rt-query">
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

              <div className="rt-chain">
                {traceSteps.map((span, index) => {
                  const reached =
                    revealRatio >= 1
                      ? true
                      : index / Math.max(1, traceSteps.length - 1) <= revealRatio;

                  return (
                    <button
                      key={span.spanId}
                      className={[
                        'rt-chain-item',
                        `is-${span.outcome.toLowerCase()}`,
                        reached ? '' : 'is-pending',
                        selectedItemId === span.itemId ? 'is-selected' : ''
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => focusNode(span.itemId)}
                    >
                      <span className="rt-chain-step">{index + 1}</span>
                      <span className="rt-chain-main">
                        <strong>
                          {displayNameById.get(span.itemId) ?? span.serviceName}
                        </strong>
                        <span className="rt-mono">{span.operation}</span>
                      </span>
                      <span className="rt-chain-meta">
                        <em>{formatDuration(span.durationMs)}</em>
                        <span className={span.outcome === 'OK' ? '' : 'is-bad'}>
                          {span.statusCode}
                        </span>
                      </span>
                    </button>
                  );
                })}
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
    </div>
  );
}
