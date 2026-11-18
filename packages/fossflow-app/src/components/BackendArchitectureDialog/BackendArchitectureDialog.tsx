import React, { useCallback, useEffect, useState } from 'react';
import type { DiagramData } from '../../diagramUtils';
import type {
  ArchitectureRecord,
  ArchitectureStorageClient,
  ArchitectureSummary
} from '../../services/architectureStorage';
import { DraggableModal } from '../DraggableModal/DraggableModal';
import './BackendArchitectureDialog.css';

export type BackendArchitectureMode = 'save' | 'load';

interface Props {
  mode: BackendArchitectureMode;
  client: ArchitectureStorageClient;
  /** 当前已关联的服务器架构 id；为空表示还没保存过 */
  currentId: string | null;
  defaultTitle: string;
  diagram: DiagramData;
  onClose: () => void;
  onSaved: (record: ArchitectureRecord) => void;
  onLoaded: (record: ArchitectureRecord) => void;
}

const formatTime = (raw?: string): string => {
  if (!raw) return '';

  const value = new Date(raw);

  return Number.isNaN(value.getTime())
    ? raw
    : value.toLocaleString('zh-CN', { hour12: false });
};

/**
 * 后台架构的显式保存/加载对话框。
 *
 * 保存成功后由上层记录 architectureId，这里不保存任何 ID：
 * 身份只由「当前画布状态」持有，避免对话框内部的临时状态成为第二权威。
 */
export const BackendArchitectureDialog = ({
  mode,
  client,
  currentId,
  defaultTitle,
  diagram,
  onClose,
  onSaved,
  onLoaded
}: Props) => {
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summaries, setSummaries] = useState<ArchitectureSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setSummaries(null);
    setListError(null);

    try {
      setSummaries(await client.list());
    } catch (caught) {
      setListError(caught instanceof Error ? caught.message : '架构列表加载失败');
    }
  }, [client]);

  useEffect(() => {
    if (mode === 'load') loadList();
  }, [mode, loadList]);

  const save = async (asNew: boolean) => {
    if (busy) return;

    const trimmed = title.trim();

    if (!trimmed) {
      setError('请先填写架构标题');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const record = await client.save(
        asNew ? null : currentId,
        trimmed,
        diagram
      );

      onSaved(record);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const load = async (id: string) => {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      onLoaded(await client.load(id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '加载失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DraggableModal
      title={mode === 'save' ? '保存后台架构' : '加载后台架构'}
      onClose={onClose}
      width={560}
    >
      <div className="ba-dialog">
        {mode === 'save' ? (
          <>
            <label className="ba-field">
              <span>架构标题</span>
              <input
                className="ba-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={busy}
                maxLength={200}
                placeholder="例如：MSC 可观测性靶场"
              />
            </label>

            <p className="ba-hint">
              {currentId
                ? `将更新后台架构 ${currentId}，画布内容整体覆盖。`
                : '首次保存会创建新的后台架构，并把当前画布与该 ID 关联。'}
            </p>

            <div className="ba-actions">
              <button
                type="button"
                className="ba-btn ba-btn-primary"
                onClick={() => save(false)}
                disabled={busy}
              >
                {busy ? '保存中…' : currentId ? '更新后台架构' : '保存到后台'}
              </button>

              {currentId ? (
                <button
                  type="button"
                  className="ba-btn"
                  onClick={() => save(true)}
                  disabled={busy}
                >
                  另存为新架构
                </button>
              ) : null}

              <button
                type="button"
                className="ba-btn ba-btn-ghost"
                onClick={onClose}
                disabled={busy}
              >
                取消
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="ba-list-head">
              <span>后台架构</span>
              <button
                type="button"
                className="ba-btn ba-btn-ghost"
                onClick={loadList}
                disabled={busy}
              >
                刷新
              </button>
            </div>

            {summaries === null && !listError ? (
              <p className="ba-hint">正在读取后台架构…</p>
            ) : null}

            {listError ? (
              <div className="ba-error" role="alert">
                <strong>架构列表加载失败</strong>
                <p>{listError}</p>
              </div>
            ) : null}

            {summaries && summaries.length === 0 ? (
              <p className="ba-hint">
                后台还没有保存过架构。先在「保存后台架构」里存一份。
              </p>
            ) : null}

            {summaries && summaries.length > 0 ? (
              <ul className="ba-list">
                {summaries.map((item) => (
                  <li key={item.id}>
                    <div className="ba-list-main">
                      <span className="ba-list-title">{item.title || '(未命名)'}</span>
                      <span className="ba-list-meta">
                        {formatTime(item.updatedAt)}
                        {item.id === currentId ? ' · 当前画布' : ''}
                      </span>
                      <span className="ba-list-id">{item.id}</span>
                    </div>
                    <button
                      type="button"
                      className={
                        item.id === currentId
                          ? 'ba-btn ba-btn-primary'
                          : 'ba-btn'
                      }
                      onClick={() => load(item.id)}
                      disabled={busy}
                    >
                      {busy ? '读取中…' : '加载'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="ba-actions">
              <button
                type="button"
                className="ba-btn ba-btn-ghost"
                onClick={onClose}
                disabled={busy}
              >
                关闭
              </button>
            </div>
          </>
        )}

        {error ? (
          <div className="ba-error" role="alert">
            <strong>操作失败</strong>
            <p>{error}</p>
          </div>
        ) : null}
      </div>
    </DraggableModal>
  );
};

export default BackendArchitectureDialog;
