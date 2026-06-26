import { SavedDiagram } from '../types/editor';

interface EditorSessionDialogsProps {
  diagramName: string;
  diagrams: SavedDiagram[];
  onCloseExportDialog: () => void;
  onCloseLoadDialog: () => void;
  onCloseSaveDialog: () => void;
  onDeleteDiagram: (id: string) => void;
  onDiagramNameChange: (name: string) => void;
  onExportDiagram: () => void;
  onLoadDiagram: (diagram: SavedDiagram) => void;
  onSaveDiagram: () => void;
  showExportDialog: boolean;
  showLoadDialog: boolean;
  showSaveDialog: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/**
 * Collects the application-level save/load/export dialogs.
 * Keeps modal rendering separate from the main editor page and menu wiring.
 */
export function EditorSessionDialogs({
  diagramName,
  diagrams,
  onCloseExportDialog,
  onCloseLoadDialog,
  onCloseSaveDialog,
  onDeleteDiagram,
  onDiagramNameChange,
  onExportDiagram,
  onLoadDiagram,
  onSaveDiagram,
  showExportDialog,
  showLoadDialog,
  showSaveDialog,
  t
}: EditorSessionDialogsProps) {
  return (
    <>
      {showSaveDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.save.title')}</h2>
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeeba',
                padding: '15px',
                borderRadius: '4px',
                marginBottom: '20px'
              }}
            >
              <strong>{t('dialog.save.warningTitle')}:</strong>{' '}
              {t('dialog.save.warningMessage')}
              <br />
              <span
                dangerouslySetInnerHTML={{
                  __html: t('dialog.save.warningExport')
                }}
              />
            </div>
            <input
              type="text"
              placeholder={t('dialog.save.placeholder')}
              value={diagramName}
              onChange={(event) => onDiagramNameChange(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onSaveDiagram()}
              autoFocus
            />
            <div className="dialog-buttons">
              <button onClick={onSaveDiagram}>{t('dialog.save.btnSave')}</button>
              <button onClick={onCloseSaveDialog}>
                {t('dialog.save.btnCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLoadDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.load.title')}</h2>
            <div
              style={{
                backgroundColor: '#fff3cd',
                border: '1px solid #ffeeba',
                padding: '15px',
                borderRadius: '4px',
                marginBottom: '20px'
              }}
            >
              <strong>{t('dialog.load.noteTitle')}:</strong>{' '}
              {t('dialog.load.noteMessage')}
            </div>
            <div className="diagram-list">
              {diagrams.length === 0 ? (
                <p>{t('dialog.load.noSavedDiagrams')}</p>
              ) : (
                diagrams.map((diagram) => (
                  <div key={diagram.id} className="diagram-item">
                    <div>
                      <strong>{diagram.name}</strong>
                      <br />
                      <small>
                        {t('dialog.load.updated')}:{' '}
                        {new Date(diagram.updatedAt).toLocaleString()}
                      </small>
                    </div>
                    <div className="diagram-actions">
                      <button onClick={() => onLoadDiagram(diagram)}>
                        {t('dialog.load.btnLoad')}
                      </button>
                      <button onClick={() => onDeleteDiagram(diagram.id)}>
                        {t('dialog.load.btnDelete')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="dialog-buttons">
              <button onClick={onCloseLoadDialog}>
                {t('dialog.load.btnClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportDialog && (
        <div className="dialog-overlay">
          <div className="dialog">
            <h2>{t('dialog.export.title')}</h2>
            <div
              style={{
                backgroundColor: '#d4edda',
                border: '1px solid #c3e6cb',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px'
              }}
            >
              <p style={{ margin: '0 0 10px 0' }}>
                <strong>{t('dialog.export.recommendedTitle')}:</strong>{' '}
                {t('dialog.export.recommendedMessage')}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#155724'
                }}
              >
                {t('dialog.export.noteMessage')}
              </p>
            </div>
            <div className="dialog-buttons">
              <button onClick={onExportDiagram}>
                {t('dialog.export.btnDownload')}
              </button>
              <button onClick={onCloseExportDialog}>
                {t('dialog.export.btnCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EditorSessionDialogs;
