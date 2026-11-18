import React, { useMemo } from 'react';
import { TraceDetail, TraceSpan } from '../../services/runtime/types';
import './TraceWaterfall.css';

export interface TraceWaterfallProps {
  trace: TraceDetail | null;
  /** 0~1，回放进度；1 表示全部可见 */
  revealRatio?: number;
  /** 选中的 spanId */
  activeSpanId?: string | null;
  /** 点击某条 span */
  onSelectSpan?: (span: TraceSpan) => void;
  /** 点服务名时联动高亮图节点 */
  onSelectItem?: (itemId: string) => void;
  className?: string;
}

const SERVICE_COLORS: Record<string, string> = {
  'msc-gateway': '#a855f7',
  'msc-business-service': '#3b82f6',
  'msc-calculate-service': '#22c55e'
};

const FALLBACK_PALETTE = [
  '#0ea5e9',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#8b5cf6',
  '#f97316',
  '#10b981',
  '#64748b'
];

const OUTCOME_COLORS: Record<string, string> = {
  ERROR: '#dc2626',
  TIMEOUT: '#d97706'
};

/** 未知服务按名字 hash 取色：同一服务始终同色。 */
const hashColor = (name: string) => {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }

  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
};

const serviceColor = (serviceName: string) =>
  SERVICE_COLORS[serviceName] ?? hashColor(serviceName);

const formatMs = (ms: number) => {
  if (ms < 1) return '<1 ms';

  return `${Math.round(ms)} ms`;
};

const formatTick = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export const TraceWaterfall = ({
  trace,
  revealRatio = 1,
  activeSpanId = null,
  onSelectSpan,
  onSelectItem,
  className
}: TraceWaterfallProps) => {
  const spans = useMemo(() => {
    if (!trace) return [];

    return trace.spans.slice().sort((a, b) => a.startMs - b.startMs);
  }, [trace]);

  const totalDurationMs = useMemo(() => {
    if (!trace) return 0;

    const declared = trace.totalDurationMs > 0 ? trace.totalDurationMs : 0;
    const measured = spans.reduce(
      (max, span) => Math.max(max, span.startMs + span.durationMs),
      0
    );

    return Math.max(declared, measured, 1);
  }, [spans, trace]);

  const ratio = Math.min(1, Math.max(0, revealRatio));
  const visibleCount =
    spans.length === 0
      ? 0
      : Math.min(spans.length, Math.max(0, Math.ceil(spans.length * ratio)));
  const visibleSpans = spans.slice(0, visibleCount);

  const rootClass = ['tw-root', className].filter(Boolean).join(' ');

  if (!trace) {
    return (
      <div className={rootClass}>
        <div className="tw-empty">等待链路查询</div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="tw-axis">
        <span className="tw-axis-gutter">服务 / 操作</span>
        <div className="tw-axis-track">
          {[0, 25, 50, 75, 100].map((percent) => (
            <span
              key={percent}
              className="tw-axis-tick"
              style={{ left: `${percent}%` }}
            >
              {formatTick((totalDurationMs * percent) / 100)}
            </span>
          ))}
        </div>
        <span className="tw-axis-total">
          总耗时 {formatMs(totalDurationMs)}
        </span>
      </div>

      <div className="tw-body">
        {visibleSpans.length === 0 ? (
          <div className="tw-empty">该链路暂无 Span</div>
        ) : (
          visibleSpans.map((span, index) => {
            const baseColor = serviceColor(span.serviceName);
            const outcomeColor = OUTCOME_COLORS[span.outcome];
            const barColor = outcomeColor ?? baseColor;
            const isBad = span.outcome === 'ERROR' || span.outcome === 'TIMEOUT';
            const isActive = activeSpanId === span.spanId;

            return (
              <div
                key={span.spanId}
                className={[
                  'tw-row',
                  isBad ? 'is-bad' : '',
                  isActive ? 'is-active' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSpan?.(span)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;

                  event.preventDefault();
                  onSelectSpan?.(span);
                }}
              >
                <div
                  className="tw-label"
                  style={{ paddingLeft: span.parentSpanId ? 20 : 8 }}
                >
                  <button
                    type="button"
                    className="tw-service"
                    title={`定位节点：${span.serviceName}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (onSelectItem) {
                        onSelectItem(span.itemId);
                      } else {
                        onSelectSpan?.(span);
                      }
                    }}
                  >
                    <span
                      className="tw-sequence"
                      aria-label={`调用顺序 ${index + 1}：${span.serviceName}`}
                    >
                      {index + 1}
                    </span>
                    <span
                      className="tw-dot"
                      style={{ background: baseColor }}
                    />
                    <span className="tw-service-name">{span.serviceName}</span>
                  </button>
                  <span className="tw-operation" title={span.operation}>
                    {span.operation}
                  </span>
                </div>

                <div className="tw-track">
                  <div
                    className="tw-bar"
                    style={{
                      left: `${clampPercent((span.startMs / totalDurationMs) * 100)}%`,
                      width: `${clampPercent((span.durationMs / totalDurationMs) * 100)}%`,
                      minWidth: 2,
                      background: barColor
                    }}
                  />
                </div>

                <div className="tw-duration">
                  <span>{formatMs(span.durationMs)}</span>
                  {span.statusCode !== undefined ? (
                    <em>{span.statusCode}</em>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TraceWaterfall;
