import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ExternalPanel.css';

interface Props {
  /** 宿主机地址，默认从 window.location.hostname 推断 */
  host?: string;
  /** 当前激活的 traceId，用于跳转时带上 */
  traceId?: string | null;
  /** 当前选中的服务名，用于带过滤参数 */
  serviceName?: string | null;
}

interface ExternalSystem {
  id: string;
  name: string;
  /** 一句话用途 */
  purpose: string;
  /** 端口后面的路径 */
  path: string;
  port: number;
  icon: React.ReactNode;
}

/**
 * 这些是独立的、自带完整界面的系统，本面板只做入口。
 *
 * 不用 iframe 内嵌：SkyWalking / Grafana / Nacos 都带 X-Frame-Options 或 CSP，
 * 强行内嵌大概率白屏；代理转发又要维护一套路径改写，得不偿失。
 */
const SYSTEMS: ExternalSystem[] = [
  {
    id: 'skywalking',
    name: 'SkyWalking',
    purpose: 'APM 链路追踪与拓扑分析，按 traceId 查完整调用栈。',
    path: '/',
    port: 8080,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17.5 8 12l4 3 4-6 5 4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="8" cy="12" r="1.4" />
        <circle cx="16" cy="9" r="1.4" />
      </svg>
    )
  },
  {
    id: 'grafana',
    name: 'Grafana',
    purpose: '可视化大盘与告警面板，看趋势比看单点准。',
    path: '/',
    port: 3300,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    purpose: '指标原始查询与 PromQL 调试，验证指标是否真的采到。',
    path: '/',
    port: 9090,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3c3.9 0 6.5 2.6 6.5 6.2 0 3-1.7 4.4-1.7 6.6 0 1.4.6 2.2.6 2.2H6.6s.6-.8.6-2.2c0-2.2-1.7-3.6-1.7-6.6C5.5 5.6 8.1 3 12 3Z" strokeLinejoin="round" />
        <path d="M10 21h4" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: 'nacos',
    name: 'Nacos',
    purpose: '服务注册发现与配置中心，查实例列表、改配置。',
    path: '/nacos',
    port: 8848,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3.5" y="4" width="17" height="5" rx="1.6" />
        <rect x="3.5" y="15" width="17" height="5" rx="1.6" />
        <path d="M7 6.5h.01M7 17.5h.01" strokeLinecap="round" />
      </svg>
    )
  }
];

const inferHost = (): string => {
  if (typeof window === 'undefined') return 'localhost';

  return window.location.hostname || 'localhost';
};

const baseUrlOf = (system: ExternalSystem, host: string): string =>
  `http://${host}:${system.port}${system.path}`;

export const ExternalPanel = ({ host, traceId, serviceName }: Props) => {
  const resolvedHost = useMemo(() => host?.trim() || inferHost(), [host]);
  const service = serviceName?.trim() || null;

  const [copied, setCopied] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<string | null>(null);

  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

  const openUrl = useCallback((url: string, label: string) => {
    window.open(url, '_blank', 'noopener');
    setLastOpened(label);

    if (openTimerRef.current) clearTimeout(openTimerRef.current);

    openTimerRef.current = setTimeout(() => setLastOpened(null), 1800);
  }, []);

  const copyText = useCallback((text: string, key: string) => {
    const clipboard = navigator.clipboard;

    if (clipboard && typeof clipboard.writeText === 'function') {
      clipboard.writeText(text).catch(() => undefined);
    }

    setCopied(key);

    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);

    copyTimerRef.current = setTimeout(() => setCopied(null), 1400);
  }, []);

  const traceUrl = traceId
    ? `http://${resolvedHost}:8080/trace?traceId=${encodeURIComponent(traceId)}`
    : null;

  return (
    <div className="ep-panel">
      <div className="ep-head">
        <div className="ep-head-text">
          <strong>外部系统</strong>
          <span className="ep-host ep-mono">{resolvedHost}</span>
        </div>
        <span className="ep-note">独立系统 · 保留原生能力</span>
      </div>

      <div className="ep-context">
        {traceId ? (
          <div className="ep-ctx-row">
            <span className="ep-ctx-label">traceId</span>
            <code className="ep-ctx-value ep-mono" title={traceId}>
              {traceId}
            </code>
            <button
              type="button"
              className="ep-btn ep-btn-tiny"
              onClick={() => copyText(traceId, 'trace')}
              aria-label="复制 traceId"
            >
              {copied === 'trace' ? '已复制' : '复制'}
            </button>
          </div>
        ) : (
          <div className="ep-ctx-row is-empty">
            <span className="ep-ctx-label">traceId</span>
            <span className="ep-ctx-none">暂无，先在流量面板发起一次请求</span>
          </div>
        )}

        {service ? (
          <div className="ep-ctx-row">
            <span className="ep-ctx-label">服务</span>
            <code className="ep-ctx-value ep-mono" title={service}>
              {service}
            </code>
            <button
              type="button"
              className="ep-btn ep-btn-tiny"
              onClick={() => copyText(service, 'service')}
              aria-label="复制服务名"
            >
              {copied === 'service' ? '已复制' : '复制'}
            </button>
          </div>
        ) : null}
      </div>

      <div className="ep-grid">
        {SYSTEMS.map((system) => {
          const url = baseUrlOf(system, resolvedHost);
          const isLast = lastOpened === system.name;

          return (
            <div className="ep-card" key={system.id}>
              <div className="ep-card-head">
                <span className={`ep-card-icon is-${system.id}`} aria-hidden="true">
                  {system.icon}
                </span>
                <strong className="ep-card-name">{system.name}</strong>
                <span className="ep-badge ep-mono">:{system.port}</span>
              </div>

              <p className="ep-card-purpose">{system.purpose}</p>

              <a
                className="ep-card-url ep-mono"
                href={url}
                title={url}
                onClick={(event) => {
                  // 点击地址也走新窗口，避免当前运行视图被替换掉
                  event.preventDefault();
                  openUrl(url, system.name);
                }}
              >
                {url}
              </a>

              <div className="ep-card-actions">
                <button
                  type="button"
                  className="ep-btn ep-btn-primary"
                  onClick={() => openUrl(url, system.name)}
                >
                  {isLast ? '已打开' : '打开'}
                </button>

                {system.id === 'skywalking' && traceUrl ? (
                  <button
                    type="button"
                    className="ep-btn ep-btn-ghost"
                    onClick={() => openUrl(traceUrl, `${system.name} · trace`)}
                    title={traceUrl}
                  >
                    带 traceId 打开
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <p className="ep-foot">
        这些系统各自独立部署、页面自带完整的查询与配置能力，本界面只做入口跳转，
        不内嵌、不代理、不裁剪功能。服务名可复制后粘贴到各自界面的搜索框里过滤。
      </p>
    </div>
  );
};

export default ExternalPanel;
