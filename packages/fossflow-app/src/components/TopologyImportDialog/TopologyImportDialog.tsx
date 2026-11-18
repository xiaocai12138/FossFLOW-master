import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DiagramData } from '../../diagramUtils';
import { DraggableModal } from '../DraggableModal/DraggableModal';
import {
  fetchSources,
  importTopology,
  previewImport
} from '../../services/topologyImport';
import type {
  ImportPreview,
  RegistrySourceInfo
} from '../../services/topologyImport';
import './TopologyImportDialog.css';

const REGISTRY_BASE = '/api/observability/registry';
const DEFAULT_URL = `${REGISTRY_BASE}/services?includeInstances=true`;
const PREVIEW_NODE_LIMIT = 10;

interface Props {
  onClose: () => void;
  onImport: (diagram: DiagramData, warnings: string[]) => void;
}

type Status = 'idle' | 'loading' | 'preview' | 'error';

/** 快捷来源按钮写入的地址，来源名由后端提供，这里只做拼接 */
const urlForSource = (name: string): string =>
  `${REGISTRY_BASE}/services?source=${encodeURIComponent(
    name
  )}&includeInstances=true`;

const DEFAULT_SOURCE: RegistrySourceInfo = {
  name: '',
  displayName: '使用默认地址',
  health: { ok: false }
};

export const TopologyImportDialog = ({ onClose, onImport }: Props) => {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [includeInstances, setIncludeInstances] = useState(false);
  const [replaceCanvas, setReplaceCanvas] = useState(true);

  const [status, setStatus] = useState<Status>('idle');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sources, setSources] = useState<RegistrySourceInfo[]>([]);
  const [sourcesLoaded, setSourcesLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const importLockRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    fetchSources().then((list) => {
      if (!mountedRef.current) return;

      setSources(list);
      setSourcesLoaded(true);
    });

    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const busy = status === 'loading';

  const cancelPending = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const handleUrlChange = (value: string) => {
    setUrl(value);

    // 地址变了旧预览就失效，别让用户误以为识别结果来自新地址
    if (status === 'preview') {
      setStatus('idle');
      setPreview(null);
    }
  };

  const runPreview = async () => {
    if (busy) return;

    cancelPending();

    const controller = new AbortController();

    abortRef.current = controller;
    setStatus('loading');
    setError(null);

    try {
      const result = await previewImport(url, { includeInstances });

      if (!mountedRef.current || controller.signal.aborted) return;

      setPreview(result);
      setStatus('preview');
    } catch (caught) {
      if (!mountedRef.current || controller.signal.aborted) return;

      setError(caught instanceof Error ? caught.message : '未知错误');
      setPreview(null);
      setStatus('error');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const runImport = async () => {
    if (busy || importLockRef.current) return;

    importLockRef.current = true;
    cancelPending();

    const controller = new AbortController();

    abortRef.current = controller;
    setStatus('loading');
    setError(null);

    try {
      const result = await importTopology(url, {
        includeInstances,
        replace: replaceCanvas
      });

      if (!mountedRef.current || controller.signal.aborted) return;

      onImport(result.diagram, result.warnings);
    } catch (caught) {
      if (!mountedRef.current || controller.signal.aborted) return;

      setError(caught instanceof Error ? caught.message : '未知错误');
      setPreview(null);
      setStatus('error');
    } finally {
      importLockRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const sourceButtons = useMemo(
    () => (sources.length > 0 ? sources : [DEFAULT_SOURCE]),
    [sources]
  );

  const previewNodes = preview ? preview.nodes.slice(0, PREVIEW_NODE_LIMIT) : [];

  return (
    <DraggableModal title="导入服务拓扑" onClose={onClose} width={560}>
      <div className="ti-dialog">
        <div className="ti-grid">
          <label className="ti-field ti-span-2">
            <span>拓扑地址</span>
            <input
              className="ti-input ti-mono"
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              placeholder={DEFAULT_URL}
              spellCheck={false}
              disabled={busy}
            />
          </label>
        </div>

        <div className="ti-sources">
          <span className="ti-sources-label">快捷来源</span>
          <div className="ti-source-buttons">
            {sourceButtons.map((source) => {
              const isDefault = source.name === '';

              return (
                <button
                  key={source.name || 'default'}
                  type="button"
                  className={`ti-chip${source.health.ok ? '' : ' is-stale'}`}
                  onClick={() =>
                    handleUrlChange(isDefault ? DEFAULT_URL : urlForSource(source.name))
                  }
                  disabled={busy}
                  title={source.health.detail || source.displayName}
                >
                  {source.displayName}
                </button>
              );
            })}
          </div>

          {sourcesLoaded && sources.length === 0 ? (
            <p className="ti-hint">
              来源列表不可用，已退化为默认地址；接口就绪后这里会自动列出可用来源。
            </p>
          ) : null}
        </div>

        <div className="ti-options">
          <label className="ti-check">
            <input
              type="checkbox"
              checked={includeInstances}
              onChange={(event) => setIncludeInstances(event.target.checked)}
              disabled={busy}
            />
            <span>包含实例</span>
          </label>

          <label className="ti-check">
            <input
              type="checkbox"
              checked={replaceCanvas}
              onChange={(event) => setReplaceCanvas(event.target.checked)}
              disabled={busy}
            />
            <span>覆盖当前画布</span>
          </label>
        </div>

        <div className="ti-actions">
          <button type="button" className="ti-btn" onClick={runPreview} disabled={busy}>
            {busy ? '请求中…' : '预览'}
          </button>

          <button
            type="button"
            className="ti-btn ti-btn-primary"
            onClick={runImport}
            disabled={busy}
          >
            导入到画布
          </button>

          <button
            type="button"
            className="ti-btn ti-btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            取消
          </button>
        </div>

        {status === 'error' && error ? (
          <div className="ti-error" role="alert">
            <strong>导入失败</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {status === 'preview' && preview ? (
          <div className="ti-preview">
            <div className="ti-stats">
              <span className="ti-stat">
                <em>{preview.nodes.length}</em> 节点
              </span>
              <span className="ti-stat">
                <em>{preview.edges.length}</em> 连线
              </span>
              {preview.catalog.source ? (
                <span className="ti-stat ti-stat-source">
                  {preview.catalog.source}
                </span>
              ) : null}
            </div>

            {preview.warnings.length > 0 ? (
              <ul className="ti-warnings">
                {preview.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {previewNodes.length > 0 ? (
              <ul className="ti-nodes">
                {previewNodes.map((node) => (
                  <li key={node.tagId}>
                    <span className="ti-node-name">{node.name}</span>
                    <span className="ti-node-tag ti-mono">{node.tagId}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ti-hint">清单为空，没有可导入的节点。</p>
            )}

            {preview.nodes.length > PREVIEW_NODE_LIMIT ? (
              <p className="ti-hint">
                仅显示前 {PREVIEW_NODE_LIMIT} 个，共 {preview.nodes.length} 个。
              </p>
            ) : null}
          </div>
        ) : null}

        {status === 'idle' ? (
          <div className="ti-empty">
            <strong>尚未预览</strong>
            <p>先点「预览」看识别到的节点与连线，确认无误再导入画布。</p>
          </div>
        ) : null}
      </div>
    </DraggableModal>
  );
};

export default TopologyImportDialog;
