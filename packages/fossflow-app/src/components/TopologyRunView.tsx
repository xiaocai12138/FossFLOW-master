import React, { useEffect, useMemo, useState } from 'react';
import { Isoflow, allLocales } from 'fossflow';
import './TopologyRunView.css';

export type AppMode = 'EDITOR' | 'RUNTIME';

interface Props {
  baseDiagram: any;
  localeKey: keyof typeof allLocales;
  onBackToEditor: () => void;
}

interface RuntimeEventData {
  item?: {
    id?: string;
    name?: string;
    description?: string;
    tag?: string;
    icon?: string;
  };
  tile?: {
    x?: number;
    y?: number;
  };
}

interface TraceStep {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PASSED' | 'DOWNSTREAM';
  duration: string;
  spanId: string;
}

interface TraceLog {
  level: 'INFO' | 'WARN' | 'ERROR';
  time: string;
  message: string;
}

/**
 * Runtime trace workspace.
 * Uses the architecture diagram as the main stage and keeps trace/log context
 * in the right-side panels so the later ELK integration has a clear landing area.
 */
export default function TopologyRunView({
  baseDiagram,
  localeKey,
  onBackToEditor
}: Props) {
  const [viewData, setViewData] = useState<any>(() => ({
    ...baseDiagram,
    fitToScreen: true
  }));
  const [traceInput, setTraceInput] = useState('');
  const [activeTraceId, setActiveTraceId] = useState('');
  const [selectedRuntimeItem, setSelectedRuntimeItem] =
    useState<RuntimeEventData | null>(null);
  const [isTraceMenuOpen, setIsTraceMenuOpen] = useState(true);

  useEffect(() => {
    setViewData({
      ...baseDiagram,
      fitToScreen: true
    });
  }, [baseDiagram]);

  /**
   * Applies a runtime-only connector treatment so replay mode feels
   * visually distinct from the editable canvas.
   */
  function applyRuntimeConnectorStyle(diagram: any) {
    if (!diagram.views) return diagram;

    return {
      ...diagram,
      views: (diagram.views || []).map((view: any) => ({
        ...view,
        connectors: (view.connectors || []).map((connector: any) => ({
          ...connector,
          style: 'DOTTED',
          width: connector.width || 10
        }))
      }))
    };
  }

  /**
   * Starts a trace replay run.
   * The data is still mocked locally, but the interaction matches the planned ELK flow.
   */
  function handleTraceQuery() {
    if (!traceInput.trim()) {
      alert('请输入 TraceId');
      return;
    }

    let updated = JSON.parse(JSON.stringify(baseDiagram));
    updated = applyRuntimeConnectorStyle(updated);
    updated.fitToScreen = false;

    setActiveTraceId(traceInput.trim());
    setViewData(updated);
  }

  /**
   * Returns the runtime workspace to its initial state.
   */
  function handleReset() {
    setActiveTraceId('');
    setSelectedRuntimeItem(null);
    setTraceInput('');
    setIsTraceMenuOpen(false);
    setViewData({
      ...baseDiagram,
      fitToScreen: true
    });
  }

  /**
   * Syncs diagram interactions into the right-side trace detail panels.
   */
  function handleRuntimeAction(data: RuntimeEventData) {
    setSelectedRuntimeItem(data);
  }

  const diagramItems = useMemo(() => {
    return (baseDiagram?.items || []).map((item: any, index: number) => ({
      ...item,
      step: index + 1
    }));
  }, [baseDiagram?.items]);

  const traceSteps = useMemo<TraceStep[]>(() => {
    if (!activeTraceId) return [];

    return diagramItems.map((item: any, index: number) => ({
      id: item.id || `step-${index}`,
      name: item.name || `服务节点 ${index + 1}`,
      status:
        selectedRuntimeItem?.item?.id === item.id
          ? 'ACTIVE'
          : index === diagramItems.length - 1
          ? 'DOWNSTREAM'
          : 'PASSED',
      duration: `${18 + index * 7} ms`,
      spanId: `${activeTraceId.slice(0, 8)}-${index + 1}`
    }));
  }, [activeTraceId, diagramItems, selectedRuntimeItem?.item?.id]);

  const traceLogs = useMemo<TraceLog[]>(() => {
    if (!activeTraceId) return [];

    const focusName =
      selectedRuntimeItem?.item?.name ||
      traceSteps[traceSteps.length - 1]?.name ||
      'gateway-service';

    return [
      {
        level: 'INFO',
        time: '14:03:21.118',
        message: `Trace ${activeTraceId} entered ${focusName}`
      },
      {
        level: 'INFO',
        time: '14:03:21.204',
        message: 'Route matched /api/order/create and downstream span started'
      },
      {
        level: 'WARN',
        time: '14:03:21.487',
        message: 'Inventory query latency exceeded runtime baseline by 42 ms'
      },
      {
        level: 'INFO',
        time: '14:03:21.682',
        message: 'ELK correlation fields prepared: traceId, spanId, serviceName'
      }
    ];
  }, [activeTraceId, selectedRuntimeItem?.item?.name, traceSteps]);

  const selectedSummary = selectedRuntimeItem?.item
    ? {
        name: selectedRuntimeItem.item.name || '未命名节点',
        tag: selectedRuntimeItem.item.tag || '未设置标签',
        description:
          selectedRuntimeItem.item.description ||
          '当前节点暂无补充说明，可在编辑模式中补充节点描述。'
      }
    : null;

  return (
    <div className="runtime-workspace">
      <header className="runtime-header">
        <div className="runtime-header-copy">
          <h1 className="runtime-header-title">Runtime Trace Workspace 架构链路运行视图</h1>
        </div>
      </header>

      <main className="runtime-main">
        <section className="runtime-canvas-panel">
          <div className="runtime-top-grid">
            <div className="runtime-metrics">
              <div className="runtime-metric-card">
                <span className="runtime-metric-label">链路节点</span>
                <strong>{diagramItems.length || 0}</strong>
              </div>
              <div className="runtime-metric-card">
                <span className="runtime-metric-label">关键 Span</span>
                <strong>{traceSteps.length || 0}</strong>
              </div>
              <div className="runtime-metric-card">
                <span className="runtime-metric-label">日志条数</span>
                <strong>{traceLogs.length || 0}</strong>
              </div>
            </div>
          </div>

          <div className="runtime-canvas-shell">
            <div className="runtime-floating-menu">
              <button
                className="runtime-floating-trigger"
                onClick={() => setIsTraceMenuOpen((open) => !open)}
                aria-expanded={isTraceMenuOpen}
              >
                {isTraceMenuOpen ? '收起 Trace 菜单' : '打开 Trace 菜单'}
              </button>

              {isTraceMenuOpen ? (
                <div className="runtime-floating-panel">
                  <div className="runtime-query-inline">
                    <label htmlFor="trace-input">TraceId</label>
                    <input
                      id="trace-input"
                      placeholder="输入 TraceId，例如 trace-order-20240515"
                      value={traceInput}
                      onChange={(event) => setTraceInput(event.target.value)}
                    />
                  </div>

                  <div className="runtime-query-actions">
                    <button
                      className="runtime-button runtime-button-primary"
                      onClick={handleTraceQuery}
                    >
                      查询链路
                    </button>
                    <button
                      className="runtime-button runtime-button-secondary"
                      onClick={handleReset}
                    >
                      重置
                    </button>
                    <button
                      className="runtime-button runtime-button-ghost"
                      onClick={onBackToEditor}
                    >
                      返回编辑模式
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <Isoflow
              initialData={viewData}
              editorMode="EXPLORABLE_READONLY"
              locale={allLocales[localeKey]}
              isRuntime={true}
              onRuntimeActionEvent={handleRuntimeAction}
            />
          </div>
        </section>

        <aside className="runtime-side-panel">
          <section className="runtime-side-card">
            <div className="runtime-side-card-header">
              <h2>Trace 摘要</h2>
              <span className="runtime-side-badge">
                {activeTraceId ? '已查询' : '未查询'}
              </span>
            </div>
            <dl className="runtime-summary-grid">
              <div>
                <dt>TraceId</dt>
                <dd>{activeTraceId || '--'}</dd>
              </div>
              <div>
                <dt>入口节点</dt>
                <dd>{traceSteps[0]?.name || 'gateway-service'}</dd>
              </div>
              <div>
                <dt>最终节点</dt>
                <dd>{traceSteps[traceSteps.length - 1]?.name || '未命名'}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{activeTraceId ? 'Running Trace Loaded' : 'Idle'}</dd>
              </div>
            </dl>
          </section>

          <section className="runtime-side-card">
            <div className="runtime-side-card-header">
              <h2>调用链路</h2>
              <span className="runtime-side-hint">ELK / Trace Pipeline</span>
            </div>
            <div className="runtime-trace-list">
              {traceSteps.length === 0 ? (
                <div className="runtime-empty-state">
                  <strong>等待 TraceId 查询</strong>
                  <p>查询后这里会展示接口经过的节点顺序、SpanId 与耗时。</p>
                </div>
              ) : (
                traceSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`runtime-trace-item runtime-trace-item-${step.status.toLowerCase()}`}
                  >
                    <div className="runtime-trace-step">{step.spanId}</div>
                    <div className="runtime-trace-content">
                      <strong>{step.name}</strong>
                      <span>{step.duration}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="runtime-side-card runtime-side-card-grow">
            <div className="runtime-side-card-header">
              <h2>日志与节点详情</h2>
              <span className="runtime-side-hint">点击画布节点联动</span>
            </div>

            <div className="runtime-node-summary">
              <h3>{selectedSummary?.name || '未选中节点'}</h3>
              <p>
                {selectedSummary?.description ||
                  '点击运行视图中的节点后，这里显示节点摘要和日志焦点。'}
              </p>
              <div className="runtime-node-meta">
                <span>{selectedSummary?.tag || '默认标签'}</span>
                <span>
                  Tile: {selectedRuntimeItem?.tile?.x ?? '--'}, {selectedRuntimeItem?.tile?.y ?? '--'}
                </span>
              </div>
            </div>

            <div className="runtime-log-list">
              {traceLogs.length === 0 ? (
                <div className="runtime-empty-state">
                  <strong>暂无日志上下文</strong>
                  <p>
                    这里预留给 ELK 查询结果，后续可展示原始日志、错误堆栈和慢调用信息。
                  </p>
                </div>
              ) : (
                traceLogs.map((log, index) => (
                  <div key={`${log.time}-${index}`} className="runtime-log-item">
                    <span className={`runtime-log-level runtime-log-level-${log.level.toLowerCase()}`}>
                      {log.level}
                    </span>
                    <div className="runtime-log-content">
                      <strong>{log.time}</strong>
                      <p>{log.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
