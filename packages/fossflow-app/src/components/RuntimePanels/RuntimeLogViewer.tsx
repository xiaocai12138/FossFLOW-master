import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LogLevel, ServiceLog } from '../../services/runtime/types';
import type { LogColors } from '../../services/runtime/runtimeViewConfig';

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const FILTERS = ['ALL', 'INFO', 'WARN', 'ERROR'] as const;
type Filter = (typeof FILTERS)[number];

interface Props {
  entries: ServiceLog[];
  sourceNames: ReadonlyMap<string, string>;
  selectedLog: ServiceLog | null;
  onSelect: (log: ServiceLog | null) => void;
  colors: LogColors;
  loading: boolean;
  notice?: string;
}

const matchesLevel = (log: ServiceLog, filter: Filter) =>
  filter === 'ALL' || LEVEL_ORDER[log.level] >= LEVEL_ORDER[filter];

function getLogIndex(viewer: HTMLElement, node: Node | null | undefined): number | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const record = element?.closest<HTMLElement>('[data-log-index]');
  return record && viewer.contains(record) ? Number(record.dataset.logIndex) : null;
}

export function RuntimeLogViewer({
  entries,
  sourceNames,
  selectedLog,
  onSelect,
  colors,
  loading,
  notice
}: Props) {
  const [levelFilter, setLevelFilter] = useState<Filter>('ALL');
  const viewerRef = useRef<HTMLPreElement>(null);
  const visibleLogs = useMemo(
    () => entries.filter((log) => matchesLevel(log, levelFilter)),
    [entries, levelFilter]
  );

  useEffect(() => {
    const handleSelectionChange = () => {
      const viewer = viewerRef.current;
      if (!viewer) return;

      const index = getLogIndex(viewer, document.getSelection()?.focusNode);
      if (index !== null && visibleLogs[index]) onSelect(visibleLogs[index]);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [onSelect, visibleLogs]);

  const handleViewerKeyDown = (event: React.KeyboardEvent<HTMLPreElement>) => {
    const viewer = event.currentTarget;
    const selection = document.getSelection();
    if (!selection) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selection.selectAllChildren(viewer);
      return;
    }
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    event.preventDefault();
    const current = getLogIndex(viewer, selection.focusNode) ?? (
      selectedLog ? visibleLogs.indexOf(selectedLog) : -1
    );
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const next = current < 0 ? 0 : current + direction;
    const record = viewer.children.item(next);
    if (!record?.firstChild || !visibleLogs[next]) return;

    if (event.shiftKey && viewer.contains(selection.anchorNode)) {
      selection.extend(record.firstChild, 0);
    } else {
      selection.collapse(record.firstChild, 0);
    }
    record.scrollIntoView?.({ block: 'nearest' });
    onSelect(visibleLogs[next]);
  };

  return (
    <section className="rt-logs" aria-label="调用日志" aria-busy={loading}>
      <div className="rt-log-head">
        <span className="rt-log-count">{loading ? '正在加载…' : `${visibleLogs.length} 条日志`}</span>
        <div className="rt-segmented" role="group" aria-label="日志级别">
          {FILTERS.map((level) => (
            <button
              key={level}
              type="button"
              className={levelFilter === level ? 'rt-segment is-active' : 'rt-segment'}
              aria-pressed={levelFilter === level}
              onClick={() => {
                setLevelFilter(level);
                if (selectedLog && !matchesLevel(selectedLog, level)) onSelect(null);
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>
      {notice && <div className="rt-empty" role="status">{notice}</div>}
      {loading ? (
        <div className="rt-empty" role="status">正在加载日志…</div>
      ) : visibleLogs.length > 0 ? (
        <pre
          className="rt-log-console"
          ref={viewerRef}
          role="document"
          aria-label="日志内容"
          tabIndex={0}
          onKeyDown={handleViewerKeyDown}
          onClick={(event) => {
            if (!document.getSelection()?.isCollapsed) return;
            const index = getLogIndex(event.currentTarget, event.target as Node);
            if (index !== null && visibleLogs[index]) onSelect(visibleLogs[index]);
          }}
        >
          {visibleLogs.map((log, index) => (
            <span
              key={JSON.stringify([log.itemId, log.id])}
              style={{ color: colors[log.level] }}
              data-log-index={index}
              data-active={selectedLog === log ? 'true' : undefined}
            >
              <time className="rt-log-time" dateTime={log.timestamp}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </time>
              {'  '}
              <strong className="rt-log-level">{log.level}</strong>
              {'  '}
              <span className="rt-log-source">{sourceNames.get(log.itemId) ?? log.itemId}</span>
              {'  '}
              <span>{log.message}</span>
              {index < visibleLogs.length - 1 && '\n'}
            </span>
          ))}
        </pre>
      ) : !notice && (
        <div className="rt-empty" role="status">暂无匹配日志</div>
      )}
    </section>
  );
}
