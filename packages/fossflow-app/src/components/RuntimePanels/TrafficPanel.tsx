import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { TrafficCall } from '../../services/runtime/trafficClient';
import { fireTrafficCall, startLoadLoop } from '../../services/runtime/trafficClient';
import './TrafficPanel.css';

interface Props {
  /** 反代前缀，默认空串走同源 /business/ */
  baseUrl?: string;
  /** 产生带 traceId 的结果时回调，供父组件加载链路 */
  onTrace?: (traceId: string) => void;
  /** 记录累积（父组件如需展示在画布底部流速条） */
  onCallsChange?: (calls: TrafficCall[]) => void;
}

/** 压测可能跑出上万条，只保留最近这么多条，避免内存与渲染失控 */
const MAX_CALLS = 500;

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

const formatClock = (iso: string): string => {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return '--:--:--';

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}.${pad(date.getMilliseconds(), 3)}`;
};

const formatDuration = (ms: number) => {
  if (ms < 1) return '<1 ms';

  return `${Math.round(ms)} ms`;
};

/** 从响应体里抠出 result，纯展示用；解析失败就不显示 */
const resultOf = (call: TrafficCall): string | null => {
  try {
    const parsed = JSON.parse(call.body);

    if (parsed && typeof parsed.result !== 'undefined') return String(parsed.result);
  } catch {
    /* 非 JSON 响应（例如网关错误页），忽略 */
  }

  return null;
};

const toPositiveNumber = (raw: string, fallback: number): number => {
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0) return fallback;

  return value;
};

export const TrafficPanel = ({ baseUrl = '', onTrace, onCallsChange }: Props) => {
  const [a, setA] = useState('7');
  const [b, setB] = useState('35');
  const [qps, setQps] = useState('1');
  const [total, setTotal] = useState('10');

  const [calls, setCalls] = useState<TrafficCall[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const stopRef = useRef<(() => void) | null>(null);
  const doneRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 父组件回调用 ref 存，避免内联 arrow 每次渲染都触发 effect
  const onCallsChangeRef = useRef(onCallsChange);
  const onTraceRef = useRef(onTrace);

  onCallsChangeRef.current = onCallsChange;
  onTraceRef.current = onTrace;

  useEffect(() => {
    onCallsChangeRef.current?.(calls);
  }, [calls]);

  // 自动滚到最新一条
  useEffect(() => {
    const node = scrollRef.current;

    if (node) node.scrollTop = node.scrollHeight;
  }, [calls]);

  // 卸载时停掉压测，别让 interval 泄漏到别的页面
  useEffect(() => {
    return () => {
      stopRef.current?.();
      stopRef.current = null;

      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const appendCall = useCallback((call: TrafficCall) => {
    setCalls((prev) => {
      const next = prev.concat(call);

      return next.length > MAX_CALLS ? next.slice(next.length - MAX_CALLS) : next;
    });
  }, []);

  const copyTraceId = useCallback((traceId: string) => {
    const clipboard = navigator.clipboard;

    if (clipboard && typeof clipboard.writeText === 'function') {
      clipboard.writeText(traceId).catch(() => undefined);
    }

    setCopied(traceId);

    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    copyTimerRef.current = setTimeout(() => setCopied(null), 1400);
  }, []);

  const handleFireOnce = async () => {
    if (running) return;

    const call = await fireTrafficCall({
      baseUrl,
      a: toPositiveNumber(a, 1),
      b: toPositiveNumber(b, 1)
    });

    appendCall(call);
  };

  const handleStart = () => {
    if (running) return;

    const plan = Math.max(1, Math.floor(toPositiveNumber(total, 10)));

    doneRef.current = 0;
    setProgress({ done: 0, total: plan });
    setRunning(true);

    stopRef.current = startLoadLoop({
      baseUrl,
      a: toPositiveNumber(a, 1),
      b: toPositiveNumber(b, 1),
      qps: toPositiveNumber(qps, 1),
      total: plan,
      onResult: (call) => {
        doneRef.current += 1;
        appendCall(call);
        setProgress({ done: doneRef.current, total: plan });
      },
      onDone: () => {
        stopRef.current = null;
        setRunning(false);
      }
    });
  };

  const handleStop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setRunning(false);
  };

  const handleClear = () => {
    setCalls([]);
    setProgress(null);
    setCopied(null);
  };

  const withTrace = calls.filter((call) => Boolean(call.traceId)).length;
  const okCount = calls.filter((call) => call.ok).length;
  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <div className="tp-panel">
      <div className="tp-params">
        <label className="tp-field">
          <span>a</span>
          <input
            type="number"
            value={a}
            onChange={(event) => setA(event.target.value)}
            aria-label="加数 a"
          />
        </label>

        <label className="tp-field">
          <span>b</span>
          <input
            type="number"
            value={b}
            onChange={(event) => setB(event.target.value)}
            aria-label="加数 b"
          />
        </label>

        <label className="tp-field">
          <span>QPS</span>
          <input
            type="number"
            min={1}
            step={1}
            value={qps}
            onChange={(event) => setQps(event.target.value)}
            aria-label="QPS"
          />
        </label>

        <label className="tp-field">
          <span>总次数</span>
          <input
            type="number"
            min={1}
            step={1}
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            aria-label="总次数"
          />
        </label>
      </div>

      <div className="tp-actions">
        <button
          type="button"
          className="tp-btn tp-btn-primary"
          onClick={handleFireOnce}
          disabled={running}
        >
          发起一次
        </button>
        <button
          type="button"
          className="tp-btn"
          onClick={handleStart}
          disabled={running}
        >
          开始压测
        </button>
        <button
          type="button"
          className="tp-btn tp-btn-danger"
          onClick={handleStop}
          disabled={!running}
        >
          停止
        </button>
        <button
          type="button"
          className="tp-btn tp-btn-ghost"
          onClick={handleClear}
          disabled={calls.length === 0 && !progress}
        >
          清空
        </button>

        <span className="tp-summary">
          {calls.length} 次 · {okCount} OK · {withTrace} 有 traceid
        </span>
      </div>

      {running || progress ? (
        <div className="tp-progress">
          <div className="tp-progress-track">
            <div className="tp-progress-fill" style={{ width: `${percent}%` }} />
          </div>
          <span className="tp-progress-text">
            {progress ? `${progress.done}/${progress.total}` : '0/0'}
            <em>{running ? '压测中' : '已完成'}</em>
          </span>
        </div>
      ) : null}

      {calls.length === 0 ? (
        <div className="tp-empty">
          <strong>尚未发起请求</strong>
          <p>点击「发起一次」打一条真实业务请求，或设置 QPS 后开始压测。</p>
        </div>
      ) : (
        <div className="tp-table-wrap" ref={scrollRef}>
          <table className="tp-table">
            <thead>
              <tr>
                <th className="tp-col-idx">#</th>
                <th>时间</th>
                <th>a+b</th>
                <th>状态码</th>
                <th>耗时</th>
                <th>traceid</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {calls.map((call, index) => {
                const result = resultOf(call);
                const isCopied = copied !== null && copied === call.traceId;

                return (
                  <tr
                    key={call.id}
                    className={call.ok ? 'is-ok' : 'is-bad'}
                    onClick={() => {
                      if (call.traceId) copyTraceId(call.traceId);
                    }}
                    title={call.traceId ? `${call.traceId}（点击复制）` : call.body}
                  >
                    <td className="tp-col-idx tp-mono">{index + 1}</td>
                    <td className="tp-mono tp-time">{formatClock(call.at)}</td>
                    <td className="tp-mono">
                      {call.a} + {call.b}
                      {result !== null ? <em className="tp-result">= {result}</em> : null}
                    </td>
                    <td className="tp-mono tp-status">{call.status || 'ERR'}</td>
                    <td className="tp-mono">{formatDuration(call.durationMs)}</td>
                    <td className="tp-mono tp-trace">
                      {call.traceId ? (
                        <span className="tp-trace-id">
                          {call.traceId}
                          {isCopied ? <em>已复制</em> : null}
                        </span>
                      ) : (
                        <span className="tp-trace-none">无 traceid</span>
                      )}
                    </td>
                    <td className="tp-col-act">
                      {call.traceId ? (
                        <button
                          type="button"
                          className="tp-link"
                          onClick={(event) => {
                            event.stopPropagation();
                            onTraceRef.current?.(call.traceId as string);
                          }}
                        >
                          查看链路
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TrafficPanel;
