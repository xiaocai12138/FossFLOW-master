import { useEffect, useRef, useState } from 'react';
import ChangeLanguage from './ChangeLanguage';

interface EditorActionMenuProps {
  canQuickSave: boolean;
  currentDiagramLabel: string;
  hasUnsavedChanges: boolean;
  iconSource: 'filesystem' | 'npm';
  onChangeIconSource: (source: 'filesystem' | 'npm') => void;
  onEnterRunView: () => void;
  onExportFile: () => void;
  onLoadSession: () => void;
  onNewDiagram: () => void;
  onOpenServerStorage: () => void;
  onQuickSaveSession: () => void;
  onSaveSession: () => void;
  serverStorageAvailable: boolean;
  sessionStorageNote: string;
}

/**
 * Floating action menu for editor-level actions.
 * Owns its open/close behavior so the page component can focus on editor state.
 */
export function EditorActionMenu({
  canQuickSave,
  currentDiagramLabel,
  hasUnsavedChanges,
  iconSource,
  onChangeIconSource,
  onEnterRunView,
  onExportFile,
  onLoadSession,
  onNewDiagram,
  onOpenServerStorage,
  onQuickSaveSession,
  onSaveSession,
  serverStorageAvailable,
  sessionStorageNote
}: EditorActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const closeAndRun = (handler: () => void) => {
    handler();
    setIsOpen(false);
  };

  return (
    <div className="app-floating-menu" ref={menuRef}>
      <button
        className="app-menu-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Actions
      </button>

      {isOpen && (
        <div className="app-menu-panel">
          <div className="app-menu-section">
            <button
              className="app-menu-item"
              onClick={() => closeAndRun(onNewDiagram)}
            >
              新建图表
            </button>

            {serverStorageAvailable && (
              <button
                className="app-menu-item app-menu-item-accent"
                onClick={() => closeAndRun(onOpenServerStorage)}
              >
                服务端图表
              </button>
            )}

            <button
              className="app-menu-item"
              onClick={() => closeAndRun(onSaveSession)}
            >
              保存（仅会话）
            </button>

            <button
              className="app-menu-item"
              onClick={() => closeAndRun(onLoadSession)}
            >
              加载（仅会话）
            </button>

            <button
              className="app-menu-item app-menu-item-primary"
              onClick={() => closeAndRun(onExportFile)}
            >
              导出文件
            </button>

            <button
              className="app-menu-item"
              disabled={!canQuickSave}
              onClick={() => closeAndRun(onQuickSaveSession)}
              title="Save to current session only"
            >
              快速保存（会话）
            </button>

            <button
              className="app-menu-item app-menu-item-success"
              onClick={() => closeAndRun(onEnterRunView)}
            >
              进入运行视图
            </button>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-section app-menu-inline">
            <span className="app-menu-label">Language</span>
            <ChangeLanguage />
          </div>

          <div className="app-menu-section">
            <label className="app-menu-field">
              <span className="app-menu-label">Icon Source</span>
              <select
                className="app-menu-select"
                value={iconSource}
                onChange={(event) =>
                  onChangeIconSource(event.target.value as 'filesystem' | 'npm')
                }
              >
                <option value="filesystem">Filesystem</option>
                <option value="npm">NPM</option>
              </select>
            </label>
          </div>

          <div className="app-menu-divider" />

          <div className="app-menu-status">
            <div className="app-menu-status-title">{currentDiagramLabel}</div>
            <div className="app-menu-status-meta">
              {hasUnsavedChanges ? 'Modified' : 'Saved'}
            </div>
            <div className="app-menu-status-note">{sessionStorageNote}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditorActionMenu;
