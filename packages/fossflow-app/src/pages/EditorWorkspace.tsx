import { useEffect, useMemo, useState } from 'react';
import { Isoflow, allLocales } from 'fossflow';
import { useTranslation } from 'react-i18next';
import TopologyRunView, { AppMode } from '../components/TopologyRunView';
import { DiagramManager } from '../components/DiagramManager';
import EditorSessionDialogs from '../components/EditorSessionDialogs';
import ChangeLanguage from '../components/ChangeLanguage';
import { StorageManager } from '../StorageManager';
import { storageManager } from '../services/storageService';
import { useIconPackManager } from '../services/iconPackManagerV2';
import { DiagramData } from '../diagramUtils';
import { SavedDiagram } from '../types/editor';
import '../App.css';

/**
 * Main editor page.
 * Owns editor state, persistence flow, and page-level event handlers.
 */
export default function EditorWorkspace() {
  const iconPackManager = useIconPackManager();
  const iconSource = (iconPackManager as any).iconSource as 'filesystem' | 'npm';
  const setIconSource = (iconPackManager as any).setIconSource as (
    source: 'filesystem' | 'npm'
  ) => void;

  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [serverStorageAvailable, setServerStorageAvailable] = useState(false);
  const [fossflowKey, setFossflowKey] = useState(0);
  const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('EDITOR');

  const { t, i18n } = useTranslation('app');

  const defaultColors = useMemo(
    () => [
      { id: 'blue', value: '#0066cc' },
      { id: 'green', value: '#00aa00' },
      { id: 'red', value: '#cc0000' },
      { id: 'orange', value: '#ff9900' },
      { id: 'purple', value: '#9900cc' },
      { id: 'black', value: '#000000' },
      { id: 'gray', value: '#666666' }
    ],
    []
  );

  const [diagramData, setDiagramData] = useState<DiagramData>(() => {
    const lastOpenedData = localStorage.getItem('fossflow-last-opened-data');

    if (lastOpenedData) {
      try {
        const data = JSON.parse(lastOpenedData);
        const importedIcons = (data.icons || []).filter(
          (icon: any) => icon.collection === 'imported'
        );

        return {
          ...data,
          icons: importedIcons,
          colors: data.colors?.length ? data.colors : defaultColors,
          fitToScreen: data.fitToScreen !== false
        };
      } catch (error) {
        console.error('Failed to load last opened data:', error);
      }
    }

    return {
      title: 'Untitled Diagram',
      icons: [],
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
  });

  useEffect(() => {
    storageManager
      .initialize()
      .then(() => {
        setServerStorageAvailable(storageManager.isServerStorage());
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setDiagramData((previous) => ({
      ...previous,
      icons: [
        ...iconPackManager.loadedIcons,
        ...(previous.icons || []).filter((icon) => icon.collection === 'imported')
      ]
    }));
  }, [iconPackManager.loadedIcons]);

  useEffect(() => {
    const savedDiagrams = localStorage.getItem('fossflow-diagrams');
    if (!savedDiagrams) return;

    setDiagrams(JSON.parse(savedDiagrams));

    const lastOpenedId = localStorage.getItem('fossflow-last-opened');
    if (!lastOpenedId) return;

    try {
      const allDiagrams = JSON.parse(savedDiagrams);
      const lastDiagram = allDiagrams.find(
        (diagram: SavedDiagram) => diagram.id === lastOpenedId
      );

      if (lastDiagram) {
        setCurrentDiagram(lastDiagram);
        setDiagramName(lastDiagram.name);
        setCurrentModel(diagramData);
      }
    } catch (error) {
      console.error('Failed to restore last diagram metadata:', error);
    }
  }, [diagramData]);

  useEffect(() => {
    try {
      const diagramsToStore = diagrams.map((diagram) => ({
        ...diagram,
        data: {
          ...diagram.data,
          icons: []
        }
      }));

      localStorage.setItem('fossflow-diagrams', JSON.stringify(diagramsToStore));
    } catch (error) {
      console.error('Failed to save diagrams:', error);

      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert(t('alert.quotaExceeded'));
      }
    }
  }, [diagrams, t]);

  useEffect(() => {
    if (!currentModel || !hasUnsavedChanges || !currentDiagram) return;

    const autoSaveTimer = setTimeout(() => {
      const importedIcons = (currentModel?.icons || diagramData.icons || []).filter(
        (icon) => icon.collection === 'imported'
      );

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

      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === currentDiagram.id ? updatedDiagram : diagram
        )
      );

      try {
        localStorage.setItem(
          'fossflow-last-opened-data',
          JSON.stringify(savedData)
        );
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Auto-save failed:', error);

        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          alert(t('alert.autoSaveFailed'));
          setShowStorageManager(true);
        }
      }
    }, 5000);

    return () => clearTimeout(autoSaveTimer);
  }, [currentDiagram, currentModel, diagramData.icons, diagramName, hasUnsavedChanges, t]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;

      event.preventDefault();
      event.returnValue = t('alert.beforeUnload');
      return event.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, t]);

  const handleSaveDiagram = () => {
    if (!diagramName.trim()) {
      alert(t('alert.enterDiagramName'));
      return;
    }

    const existingDiagram = diagrams.find(
      (diagram) => diagram.name === diagramName.trim() && diagram.id !== currentDiagram?.id
    );

    if (existingDiagram) {
      const confirmOverwrite = window.confirm(
        t('alert.diagramExists', { name: diagramName })
      );

      if (!confirmOverwrite) return;
    }

    const importedIcons = (currentModel?.icons || diagramData.icons || []).filter(
      (icon) => icon.collection === 'imported'
    );

    const savedData: DiagramData = {
      title: diagramName,
      icons: importedIcons,
      colors: currentModel?.colors || diagramData.colors || [],
      items: currentModel?.items || diagramData.items || [],
      views: currentModel?.views || diagramData.views || [],
      fitToScreen: true
    };

    const nextDiagram: SavedDiagram = {
      id: currentDiagram?.id || Date.now().toString(),
      name: diagramName,
      data: savedData,
      createdAt: currentDiagram?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (currentDiagram) {
      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === currentDiagram.id ? nextDiagram : diagram
        )
      );
    } else if (existingDiagram) {
      setDiagrams((previous) =>
        previous.map((diagram) =>
          diagram.id === existingDiagram.id
            ? {
                ...nextDiagram,
                id: existingDiagram.id,
                createdAt: existingDiagram.createdAt
              }
            : diagram
        )
      );
      nextDiagram.id = existingDiagram.id;
      nextDiagram.createdAt = existingDiagram.createdAt;
    } else {
      setDiagrams((previous) => [...previous, nextDiagram]);
    }

    setCurrentDiagram(nextDiagram);
    setShowSaveDialog(false);
    setHasUnsavedChanges(false);

    try {
      localStorage.setItem('fossflow-last-opened', nextDiagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(nextDiagram.data)
      );
    } catch (error) {
      console.error('Failed to save diagram:', error);

      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert(t('alert.storageFull'));
        setShowStorageManager(true);
      }
    }
  };

  const handleLoadDiagram = async (diagram: SavedDiagram) => {
    if (hasUnsavedChanges && !window.confirm(t('alert.unsavedChanges'))) {
      return;
    }

    await iconPackManager.loadPacksForDiagram(diagram.data.items || []);

    const importedIcons = (diagram.data.icons || []).filter(
      (icon: any) => icon.collection === 'imported'
    );
    const dataWithIcons = {
      ...diagram.data,
      icons: [...iconPackManager.loadedIcons, ...importedIcons]
    };

    setCurrentDiagram(diagram);
    setDiagramName(diagram.name);
    setDiagramData(dataWithIcons);
    setCurrentModel(dataWithIcons);
    setFossflowKey((previous) => previous + 1);
    setShowLoadDialog(false);
    setHasUnsavedChanges(false);

    try {
      localStorage.setItem('fossflow-last-opened', diagram.id);
      localStorage.setItem(
        'fossflow-last-opened-data',
        JSON.stringify(diagram.data)
      );
    } catch (error) {
      console.error('Failed to save last opened:', error);
    }
  };

  const handleDeleteDiagram = (id: string) => {
    if (!window.confirm(t('alert.confirmDelete'))) return;

    setDiagrams((previous) => previous.filter((diagram) => diagram.id !== id));

    if (currentDiagram?.id === id) {
      setCurrentDiagram(null);
      setDiagramName('');
    }
  };

  const handleCreateNewDiagram = () => {
    const message = hasUnsavedChanges
      ? t('alert.unsavedChangesExport')
      : t('alert.createNewDiagram');

    if (!window.confirm(message)) return;

    const emptyDiagram: DiagramData = {
      title: 'Untitled Diagram',
      icons: iconPackManager.loadedIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };

    setCurrentDiagram(null);
    setDiagramName('');
    setDiagramData(emptyDiagram);
    setCurrentModel(emptyDiagram);
    setFossflowKey((previous) => previous + 1);
    setHasUnsavedChanges(false);

    localStorage.removeItem('fossflow-last-opened');
    localStorage.removeItem('fossflow-last-opened-data');
  };

  const handleModelUpdated = (model: any) => {
    const updatedModel: DiagramData = {
      title: model.title || diagramName || 'Untitled Diagram',
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

  const handleExportDiagram = () => {
    const modelToExport = currentModel || diagramData;
    const allModelIcons = modelToExport.icons || [];
    const diagramImportedIcons = (diagramData.icons || []).filter(
      (icon) => icon.collection === 'imported'
    );

    const iconMap = new Map();
    allModelIcons.forEach((icon) => iconMap.set(icon.id, icon));
    diagramImportedIcons.forEach((icon) => {
      if (!iconMap.has(icon.id)) {
        iconMap.set(icon.id, icon);
      }
    });

    const exportData = {
      title: diagramName || modelToExport.title || 'Exported Diagram',
      icons: Array.from(iconMap.values()),
      colors: modelToExport.colors || [],
      items: modelToExport.items || [],
      views: modelToExport.views || [],
      fitToScreen: true
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${diagramName || 'diagram'}-${new Date()
      .toISOString()
      .split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);

    setShowExportDialog(false);
    setHasUnsavedChanges(false);
  };

  const handleDiagramManagerLoad = async (id: string, data: any) => {
    await iconPackManager.loadPacksForDiagram(data.items || []);

    const loadedIcons = data.icons || [];
    const hasDefaultIcons = loadedIcons.some(
      (icon: any) =>
        icon.collection === 'isoflow' ||
        icon.collection === 'aws' ||
        icon.collection === 'gcp'
    );

    const finalIcons = hasDefaultIcons
      ? loadedIcons
      : [
          ...iconPackManager.loadedIcons,
          ...loadedIcons.filter((icon: any) => icon.collection === 'imported')
        ];

    const mergedData: DiagramData = {
      ...data,
      title: data.title || data.name || 'Loaded Diagram',
      icons: finalIcons,
      colors: data.colors?.length ? data.colors : defaultColors,
      fitToScreen: data.fitToScreen !== false
    };

    const loadedDiagram: SavedDiagram = {
      id,
      name: data.name || 'Loaded Diagram',
      data: mergedData,
      createdAt: data.created || new Date().toISOString(),
      updatedAt: data.lastModified || new Date().toISOString()
    };

    setDiagramName(loadedDiagram.name);
    setCurrentDiagram(loadedDiagram);
    setCurrentModel(mergedData);
    setHasUnsavedChanges(false);
    setDiagramData(mergedData);
    setFossflowKey((previous) => previous + 1);
  };

  const handleOpenSaveDialog = () => setShowSaveDialog(true);
  const handleOpenLoadDialog = () => setShowLoadDialog(true);
  const handleOpenExportDialog = () => setShowExportDialog(true);
  const handleOpenServerStorage = () => setShowDiagramManager(true);
  const handleCloseSaveDialog = () => setShowSaveDialog(false);
  const handleCloseLoadDialog = () => setShowLoadDialog(false);
  const handleCloseExportDialog = () => setShowExportDialog(false);
  const handleCloseDiagramManager = () => setShowDiagramManager(false);
  const handleOpenRunView = () => {
    setDiagramData(currentModel || diagramData);
    setAppMode('RUNTIME');
  };
  const handleQuickSaveSession = () => {
    if (currentDiagram && hasUnsavedChanges) {
      handleSaveDiagram();
    }
  };

  const handleIconSourceChange = (source: 'filesystem' | 'npm') => {
    setIconSource(source);

    try {
      require('../services/iconFileSystemLoader').clearIconCache();
    } catch (error) {}

    iconPackManager.loadAllPacks();
  };

  const currentDiagramLabel = currentDiagram
    ? `${t('status.current')}: ${currentDiagram.name}`
    : diagramName || t('status.untitled');

  const iconPackManagerProps = {
    lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
    onToggleLazyLoading: iconPackManager.toggleLazyLoading,
    packInfo: Object.values(iconPackManager.packInfo),
    enabledPacks: iconPackManager.enabledPacks,
    onTogglePack: iconPackManager.togglePack
  };

  if (appMode === 'RUNTIME') {
    return (
      <TopologyRunView
        baseDiagram={currentModel || diagramData}
        localeKey={i18n.language as keyof typeof allLocales}
        onBackToEditor={() => setAppMode('EDITOR')}
      />
    );
  }

  return (
    <div className="App">
      <div className="fossflow-container">
        <Isoflow
          key={fossflowKey}
          initialData={diagramData}
          onModelUpdated={handleModelUpdated}
          editorMode="EDITABLE"
          locale={allLocales[i18n.language as keyof typeof allLocales]}
          iconPackManager={iconPackManagerProps}
          customMainMenu={{
            actions: [
              {
                id: 'new-diagram',
                label: '新建图表',
                onClick: handleCreateNewDiagram
              },
              ...(serverStorageAvailable
                ? [
                    {
                      id: 'server-storage',
                      label: '服务端图表',
                      onClick: handleOpenServerStorage,
                      tone: 'accent' as const
                    }
                  ]
                : []),
              {
                id: 'save-session',
                label: '保存（仅会话）',
                onClick: handleOpenSaveDialog
              },
              {
                id: 'load-session',
                label: '加载（仅会话）',
                onClick: handleOpenLoadDialog
              },
              {
                id: 'export-file',
                label: '导出文件',
                onClick: handleOpenExportDialog,
                tone: 'primary' as const
              },
              {
                id: 'quick-save',
                label: '快速保存（会话）',
                onClick: handleQuickSaveSession,
                disabled: !(currentDiagram && hasUnsavedChanges)
              },
              {
                id: 'run-view',
                label: '进入运行视图',
                onClick: handleOpenRunView,
                tone: 'success' as const
              }
            ],
            languageControl: <ChangeLanguage />,
            iconSourceControl: (
              <select
                className="app-menu-select"
                value={iconSource}
                onChange={(event) =>
                  handleIconSourceChange(
                    event.target.value as 'filesystem' | 'npm'
                  )
                }
              >
                <option value="filesystem">Filesystem</option>
                <option value="npm">NPM</option>
              </select>
            ),
            status: {
              title: currentDiagramLabel,
              meta: hasUnsavedChanges ? 'Modified' : 'Saved',
              note: t('status.sessionStorageNote')
            }
          }}
        />
      </div>

      <EditorSessionDialogs
        diagramName={diagramName}
        diagrams={diagrams}
        onCloseExportDialog={handleCloseExportDialog}
        onCloseLoadDialog={handleCloseLoadDialog}
        onCloseSaveDialog={handleCloseSaveDialog}
        onDeleteDiagram={handleDeleteDiagram}
        onDiagramNameChange={setDiagramName}
        onExportDiagram={handleExportDiagram}
        onLoadDiagram={handleLoadDiagram}
        onSaveDiagram={handleSaveDiagram}
        showExportDialog={showExportDialog}
        showLoadDialog={showLoadDialog}
        showSaveDialog={showSaveDialog}
        t={t}
      />

      {showDiagramManager && (
        <DiagramManager
          onClose={handleCloseDiagramManager}
          onLoadDiagram={handleDiagramManagerLoad}
          currentDiagramId={currentDiagram?.id}
          currentDiagramData={currentModel || diagramData}
        />
      )}

      {showStorageManager && (
        <StorageManager onClose={() => setShowStorageManager(false)} />
      )}
    </div>
  );
}
