import { useState, useEffect } from 'react';
import { Isoflow, allLocales } from 'fossflow';
import { useTranslation } from 'react-i18next';
import { DiagramData } from './diagramUtils';
import { StorageManager } from './StorageManager';
import { DiagramManager } from './components/DiagramManager';
import { storageManager } from './services/storageService';
import ChangeLanguage from './components/ChangeLanguage';
import { useIconPackManager } from './services/iconPackManagerV2';
import TopologyRunView, { AppMode } from './components/TopologyRunView'; // ⭐ 新增运行视图组件
import './App.css';

interface SavedDiagram {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

function App() {
  // Initialize icon pack manager (loads icons from file system)
  const iconPackManager = useIconPackManager();
  const iconSource = (iconPackManager as any).iconSource as 'filesystem' | 'npm';
  const setIconSource = (iconPackManager as any).setIconSource as (s: 'filesystem' | 'npm') => void;

  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [fossflowKey, setFossflowKey] = useState(0); // Key to force re-render of FossFLOW
  const [currentModel, setCurrentModel] = useState<DiagramData | null>(null); // Store current model state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<Date | null>(null);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [serverStorageAvailable, setServerStorageAvailable] = useState(false);

  // ⭐ 当前模式：编辑 / 运行视图
  const [appMode, setAppMode] = useState<AppMode>('EDITOR');

  // Initialize with empty diagram data
  // Create default colors for connectors
  const defaultColors = [
    { id: 'blue', value: '#0066cc' },
    { id: 'green', value: '#00aa00' },
    { id: 'red', value: '#cc0000' },
    { id: 'orange', value: '#ff9900' },
    { id: 'purple', value: '#9900cc' },
    { id: 'black', value: '#000000' },
    { id: 'gray', value: '#666666' }
  ];

  const [diagramData, setDiagramData] = useState<DiagramData>(() => {
    // Initialize with last opened data if available
    const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');
    if (lastOpenedData) {
      try {
        const data = JSON.parse(lastOpenedData);
        const importedIcons = (data.icons || []).filter((icon: any) => icon.collection === 'imported');
        return {
          ...data,
          icons: importedIcons, // Will be merged with file system icons later
          colors: data.colors?.length ? data.colors : defaultColors,
          fitToScreen: data.fitToScreen !== false
        };
      } catch (e) {
        console.error('Failed to load last opened data:', e);
      }
    }

    // Default state if no saved data
    return {
      title: 'Untitled Diagram',
      icons: [],
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
  });

  // i18n
  const { t, i18n } = useTranslation('app');

  // ================== 原有逻辑（加载 / 保存等） ==================

  // Check for server storage availability
  useEffect(() => {
    storageManager.initialize().then(() => {
      setServerStorageAvailable(storageManager.isServerStorage());
    }).catch(console.error);
  }, []);

  // Update diagramData when loaded icons change
  useEffect(() => {
    setDiagramData(prev => ({
      ...prev,
      icons: [
        ...iconPackManager.loadedIcons,
        ...(prev.icons || []).filter(icon => icon.collection === 'imported')
      ]
    }));
  }, [iconPackManager.loadedIcons]);

  // Load diagrams from localStorage on component mount
  useEffect(() => {
    const savedDiagrams = localStorage.getItem('fossflow-diagrams');
    if (savedDiagrams) {
      setDiagrams(JSON.parse(savedDiagrams));
    }

    // Load last opened diagram metadata (data is already loaded in state initialization)
    const lastOpenedId = localStorage.getItem('fossflow-last-opened');

    if (lastOpenedId && savedDiagrams) {
      try {
        const allDiagrams = JSON.parse(savedDiagrams);
        const lastDiagram = allDiagrams.find((d: SavedDiagram) => d.id === lastOpenedId);
        if (lastDiagram) {
          setCurrentDiagram(lastDiagram);
          setDiagramName(lastDiagram.name);
          // Also set currentModel to match diagramData
          setCurrentModel(diagramData);
        }
      } catch (e) {
        console.error('Failed to restore last diagram metadata:', e);
      }
    }
  }, [diagramData]);

  // Save diagrams to localStorage whenever they change
  useEffect(() => {
    try {
      // Store diagrams without the full icon data
      const diagramsToStore = diagrams.map(d => ({
        ...d,
        data: {
          ...d.data,
          icons: [] // Don't store icons with each diagram
        }
      }));
      localStorage.setItem('fossflow-diagrams', JSON.stringify(diagramsToStore));
    } catch (e) {
      console.error('Failed to save diagrams:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert(t('alert.quotaExceeded'));
      }
    }
  }, [diagrams, t]);

  const saveDiagram = () => {
    if (!diagramName.trim()) {
      alert(t('alert.enterDiagramName'));
      return;
    }

    // Check if a diagram with this name already exists (excluding current)
    const existingDiagram = diagrams.find(d =>
      d.name === diagramName.trim() && d.id !== currentDiagram?.id
    );

    if (existingDiagram) {
      const confirmOverwrite = window.confirm(
        t('alert.diagramExists', { name: diagramName })
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    // Construct save data - include only imported icons
    const importedIcons = (currentModel?.icons || diagramData.icons || [])
      .filter(icon => icon.collection === 'imported');

    const savedData = {
      title: diagramName,
      icons: importedIcons, // Save only imported icons with diagram
      colors: currentModel?.colors || diagramData.colors || [],
      items: currentModel?.items || diagramData.items || [],
      views: currentModel?.views || diagramData.views || [],
      fitToScreen: true
    };

    const newDiagram: SavedDiagram = {
      id: currentDiagram?.id || Date.now().toString(),
      name: diagramName,
      data: savedData,
      createdAt: currentDiagram?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (currentDiagram) {
      // Update existing diagram
      setDiagrams(diagrams.map(d => d.id === currentDiagram.id ? newDiagram : d));
    } else if (existingDiagram) {
      // Replace existing diagram with same name
      setDiagrams(diagrams.map(d => d.id === existingDiagram.id ? {
        ...newDiagram,
        id: existingDiagram.id,
        createdAt: existingDiagram.createdAt
      } : d));
      newDiagram.id = existingDiagram.id;
      newDiagram.createdAt = existingDiagram.createdAt;
    } else {
      // Add new diagram
      setDiagrams([...diagrams, newDiagram]);
    }

    setCurrentDiagram(newDiagram);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);
    setLastAutoSave(new Date());

    // Save as last opened
    try {
      localStorage.setItem('fossflow-last-opened', newDiagram.id);
      localStorage.setItem('fossflow-last-opened-data', JSON.stringify(newDiagram.data));
    } catch (e) {
      console.error('Failed to save diagram:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        alert(t('alert.storageFull'));
        setShowStorageManager(true);
      }
    }
  };

  const loadDiagram = async (diagram: SavedDiagram) => {
    if (hasUnsavedChanges && !window.confirm(t('alert.unsavedChanges'))) {
      return;
    }

    // Auto-detect and load required icon packs
    await iconPackManager.loadPacksForDiagram(diagram.data.items || []);

    // Merge imported icons with loaded icon set
    const importedIcons = (diagram.data.icons || []).filter((icon: any) => icon.collection === 'imported');
    const mergedIcons = [...iconPackManager.loadedIcons, ...importedIcons];
    const dataWithIcons = {
      ...diagram.data,
      icons: mergedIcons
    };

    setCurrentDiagram(diagram);
    setDiagramName(diagram.name);
    setDiagramData(dataWithIcons);
    setCurrentModel(dataWithIcons);
    setFossflowKey(prev => prev + 1); // Force re-render of FossFLOW
    setShowLoadDialog(false);
    setHasUnsavedChanges(false);

    // Save as last opened (without icons)
    try {
      localStorage.setItem('fossflow-last-opened', diagram.id);
      localStorage.setItem('fossflow-last-opened-data', JSON.stringify(diagram.data));
    } catch (e) {
      console.error('Failed to save last opened:', e);
    }
  };

  const deleteDiagram = (id: string) => {
    if (window.confirm(t('alert.confirmDelete'))) {
      setDiagrams(diagrams.filter(d => d.id !== id));
      if (currentDiagram?.id === id) {
        setCurrentDiagram(null);
        setDiagramName('');
      }
    }
  };

  const newDiagram = () => {
    const message = hasUnsavedChanges
      ? t('alert.unsavedChangesExport')
      : t('alert.createNewDiagram');

    if (window.confirm(message)) {
      const emptyDiagram: DiagramData = {
        title: 'Untitled Diagram',
        icons: iconPackManager.loadedIcons, // Use currently loaded icons
        colors: defaultColors,
        items: [],
        views: [],
        fitToScreen: true
      };
      setCurrentDiagram(null);
      setDiagramName('');
      setDiagramData(emptyDiagram);
      setCurrentModel(emptyDiagram); // Reset current model too
      setFossflowKey(prev => prev + 1); // Force re-render of FossFLOW
      setHasUnsavedChanges(false);

      // Clear last opened
      localStorage.removeItem('fossflow-last-opened');
      localStorage.removeItem('fossflow-last-opened-data');
    }
  };

  const handleModelUpdated = (model: any) => {
    // Store the current model state whenever it updates
    const updatedModel: DiagramData = {
      title: model.title || diagramName || 'Untitled',
      icons: model.icons || [],
      colors: model.colors || defaultColors,
      items: model.items || [],
      views: model.views || [],
      fitToScreen: true
    };

    setCurrentModel(updatedModel);
    setDiagramData(updatedModel);
    setHasUnsavedChanges(true);
  };

  const exportDiagram = () => {
    // Use the most recent model data - prefer currentModel as it gets updated by handleModelUpdated
    const modelToExport = currentModel || diagramData;

    // Get ALL icons from the current model (which includes both default and imported)
    const allModelIcons = modelToExport.icons || [];

    // For safety, also check diagramData for any imported icons not in currentModel
    const diagramImportedIcons = (diagramData.icons || []).filter(icon => icon.collection === 'imported');

    // Create a map to deduplicate icons by ID, preferring the ones from currentModel
    const iconMap = new Map();

    // First add all icons from the model (includes defaults + imported)
    allModelIcons.forEach(icon => {
      iconMap.set(icon.id, icon);
    });

    // Then add any imported icons from diagramData that might be missing
    diagramImportedIcons.forEach(icon => {
      if (!iconMap.has(icon.id)) {
        iconMap.set(icon.id, icon);
      }
    });

    // Get all unique icons
    const allIcons = Array.from(iconMap.values());

    const exportData = {
      title: diagramName || modelToExport.title || 'Exported Diagram',
      icons: allIcons, // Include ALL icons (default + imported) for portability
      colors: modelToExport.colors || [],
      items: modelToExport.items || [],
      views: modelToExport.views || [],
      fitToScreen: true
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    // Create a blob and download link
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName || 'diagram'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setShowExportDialog(false);
    setHasUnsavedChanges(false); // Mark as saved after export
  };

  const handleDiagramManagerLoad = async (id: string, data: any) => {
    console.log(`App: handleDiagramManagerLoad called for diagram ${id}`);

    const loadedIcons = data.icons || [];
    console.log(`App: Server sent ${loadedIcons.length} icons`);

    // Auto-detect and load required icon packs
    await iconPackManager.loadPacksForDiagram(data.items || []);

    let finalIcons;
    const hasDefaultIcons = loadedIcons.some((icon: any) =>
      icon.collection === 'isoflow' || icon.collection === 'aws' || icon.collection === 'gcp'
    );

    if (hasDefaultIcons) {
      console.log(`App: Using all ${loadedIcons.length} icons from server (includes defaults + imported)`);
      finalIcons = loadedIcons;
    } else {
      const importedIcons = loadedIcons.filter((icon: any) => icon.collection === 'imported');
      finalIcons = [...iconPackManager.loadedIcons, ...importedIcons];
      console.log(
        `App: Old format detected. Merged ${importedIcons.length} imported icons with ` +
        `${iconPackManager.loadedIcons.length} defaults = ${finalIcons.length} total`
      );
    }

    const mergedData: DiagramData = {
      ...data,
      title: data.title || data.name || 'Loaded Diagram',
      icons: finalIcons,
      colors: data.colors?.length ? data.colors : defaultColors,
      fitToScreen: data.fitToScreen !== false
    };

    const newDiagram = {
      id,
      name: data.name || 'Loaded Diagram',
      data: mergedData,
      createdAt: data.created || new Date().toISOString(),
      updatedAt: data.lastModified || new Date().toISOString()
    };

    console.log(`App: Setting all state for diagram ${id}`);

    setDiagramName(newDiagram.name);
    setCurrentDiagram(newDiagram);
    setCurrentModel(mergedData);
    setHasUnsavedChanges(false);

    setDiagramData(mergedData);
    setFossflowKey(prev => {
      const newKey = prev + 1;
      console.log(`App: Updated fossflowKey from ${prev} to ${newKey}`);
      return newKey;
    });

    console.log(`App: Finished loading diagram ${id}, final icon count: ${finalIcons.length}`);
  };

  // Auto-save functionality
  useEffect(() => {
    if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

    const autoSaveTimer = setTimeout(() => {
      const importedIcons = (currentModel?.icons || diagramData.icons || [])
        .filter(icon => icon.collection === 'imported');

      const savedData = {
        title: diagramName || currentDiagram.name,
        icons: importedIcons,
        colors: currentModel.colors || [],
        items: currentModel.items || [],
        views: currentModel.views || [],
        fitToScreen: true
      };

      const updatedDiagram: SavedDiagram = {
        ...currentDiagram,
        data: savedData,
        updatedAt: new Date().toISOString()
      };

      setDiagrams(prevDiagrams =>
        prevDiagrams.map(d => d.id === currentDiagram.id ? updatedDiagram : d)
      );

      try {
        localStorage.setItem('fossflow-last-opened-data', JSON.stringify(savedData));
        setLastAutoSave(new Date());
        setHasUnsavedChanges(false);
      } catch (e) {
        console.error('Auto-save failed:', e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          alert(t('alert.autoSaveFailed'));
          setShowStorageManager(true);
        }
      }
    }, 5000); // Auto-save after 5 seconds of changes

    return () => clearTimeout(autoSaveTimer);
  }, [currentModel, hasUnsavedChanges, currentDiagram, diagramName, diagramData.icons, t]);

  // Warn before closing if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = t('alert.beforeUnload');
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, t]);

  // ================== 渲染 ==================

  return (
    <div className="App">
      {appMode === 'EDITOR' ? (
        <>
          {/* ======= 编辑模式 ======= */}
          <div className="toolbar">
            <button onClick={newDiagram}>{t('nav.newDiagram')}</button>

            {serverStorageAvailable && (
              <button
                onClick={() => setShowDiagramManager(true)}
                style={{ backgroundColor: '#2196F3', color: 'white' }}
              >
                🌐 {t('nav.serverStorage')}
              </button>
            )}

            <button onClick={() => setShowSaveDialog(true)}>
              {t('nav.saveSessionOnly')}
            </button>
            <button onClick={() => setShowLoadDialog(true)}>
              {t('nav.loadSessionOnly')}
            </button>
            <button
              onClick={() => setShowExportDialog(true)}
              style={{ backgroundColor: '#007bff' }}
            >
              💾 {t('nav.exportFile')}
            </button>
            <button
              onClick={() => {
                if (currentDiagram && hasUnsavedChanges) {
                  saveDiagram();
                }
              }}
              disabled={!currentDiagram || !hasUnsavedChanges}
              style={{
                backgroundColor:
                  currentDiagram && hasUnsavedChanges ? '#ffc107' : '#6c757d',
                opacity: currentDiagram && hasUnsavedChanges ? 1 : 0.5,
                cursor:
                  currentDiagram && hasUnsavedChanges
                    ? 'pointer'
                    : 'not-allowed'
              }}
              title="Save to current session only"
            >
              {t('nav.quickSaveSession')}
            </button>

            {/* ⭐ 新增：进入运行视图按钮 */}
            <button
              onClick={() => {
                const base = currentModel || diagramData;
                setDiagramData(base); // 确保 diagramData 是最新的
                setAppMode('RUNTIME');
              }}
              style={{
                marginLeft: '8px',
                backgroundColor: '#4caf50',
                color: '#fff'
              }}
            >
              进入运行视图
            </button>

            <ChangeLanguage />

            {/* 图标来源切换 */}
            <label style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ marginRight: 8, fontSize: 12, color: '#333' }}>图标来源</span>
              <select
                value={iconSource}
                onChange={e => {
                  setIconSource(e.target.value as any);
                  // Clear caches in loader so change takes effect on next load
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  try { require('./services/iconFileSystemLoader').clearIconCache(); } catch (err) {}
                  // force reload enabled packs
                  iconPackManager.loadAllPacks();
                }}
              >
                <option value="filesystem">本地 (filesystem)</option>
                <option value="npm">NPM 包</option>
              </select>
            </label>

            <span className="current-diagram">
              {currentDiagram
                ? `${t('status.current')}: ${currentDiagram.name}`
                : diagramName || t('status.untitled')}
              {hasUnsavedChanges && (
                <span style={{ color: '#ff9800', marginLeft: '10px' }}>
                  • {t('status.modified')}
                </span>
              )}
              <span
                style={{
                  fontSize: '12px',
                  color: '#666',
                  marginLeft: '10px'
                }}
              >
                ({t('status.sessionStorageNote')})
              </span>
            </span>
          </div>

          <div
            className="fossflow-container"
            style={{
              height: 'calc(100vh - 50px)', // ⭐ 确保有足够高度，你可以按需求调整
              minHeight: 400,
              borderTop: '1px solid #e0e0e0',
            }}
          >
            <Isoflow
              key={fossflowKey}
              initialData={diagramData}
              onModelUpdated={handleModelUpdated}
              editorMode="EDITABLE"
              locale={allLocales[i18n.language as keyof typeof allLocales]}
              iconPackManager={{
                lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
                onToggleLazyLoading: iconPackManager.toggleLazyLoading,
                packInfo: Object.values(iconPackManager.packInfo),
                enabledPacks: iconPackManager.enabledPacks,
                onTogglePack: iconPackManager.togglePack,
              }}
            />
          </div>


          {/* Save Dialog */}
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
                  <strong>⚠️ {t('dialog.save.warningTitle')}:</strong>{' '}
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
                  onChange={e => setDiagramName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveDiagram()}
                  autoFocus
                />
                <div className="dialog-buttons">
                  <button onClick={saveDiagram}>
                    {t('dialog.save.btnSave')}
                  </button>
                  <button onClick={() => setShowSaveDialog(false)}>
                    {t('dialog.save.btnCancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Load Dialog */}
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
                  <strong>⚠️ {t('dialog.load.noteTitle')}:</strong>{' '}
                  {t('dialog.load.noteMessage')}
                </div>
                <div className="diagram-list">
                  {diagrams.length === 0 ? (
                    <p>{t('dialog.load.noSavedDiagrams')}</p>
                  ) : (
                    diagrams.map(diagram => (
                      <div key={diagram.id} className="diagram-item">
                        <div>
                          <strong>{diagram.name}</strong>
                          <br />
                          <small>
                            {t('dialog.load.updated')}:{' '}
                            {new Date(
                              diagram.updatedAt
                            ).toLocaleString()}
                          </small>
                        </div>
                        <div className="diagram-actions">
                          <button onClick={() => loadDiagram(diagram)}>
                            {t('dialog.load.btnLoad')}
                          </button>
                          <button
                            onClick={() => deleteDiagram(diagram.id)}
                          >
                            {t('dialog.load.btnDelete')}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="dialog-buttons">
                  <button onClick={() => setShowLoadDialog(false)}>
                    {t('dialog.load.btnClose')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Export Dialog */}
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
                    <strong>
                      ✅ {t('dialog.export.recommendedTitle')}:
                    </strong>{' '}
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
                  <button onClick={exportDiagram}>
                    {t('dialog.export.btnDownload')}
                  </button>
                  <button onClick={() => setShowExportDialog(false)}>
                    {t('dialog.export.btnCancel')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Storage Manager */}
          {showStorageManager && (
            <StorageManager onClose={() => setShowStorageManager(false)} />
          )}

          {/* Diagram Manager */}
          {showDiagramManager && (
            <DiagramManager
              onLoadDiagram={handleDiagramManagerLoad}
              currentDiagramId={currentDiagram?.id}
              currentDiagramData={currentModel || diagramData}
              onClose={() => setShowDiagramManager(false)}
            />
          )}
        </>
      ) : (
        /* ======= 运行视图 ======= */
        <TopologyRunView
          baseDiagram={currentModel || diagramData}
          localeKey={i18n.language as keyof typeof allLocales}
          onBackToEditor={() => setAppMode('EDITOR')}
        />
      )}
    </div>
  );
}

export default App;
