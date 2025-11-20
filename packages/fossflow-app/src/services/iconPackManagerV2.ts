import { useState, useEffect, useCallback } from 'react';
import * as fileSystemLoader from './iconFileSystemLoader';
import type { IconPackName, Icon } from './iconFileSystemLoader';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';

// Icon source preference: 'filesystem' (default) or 'npm'
const ICON_SOURCE_KEY = 'fossflow-icon-source';
export type IconSource = 'filesystem' | 'npm';

export const loadIconSourcePreference = (): IconSource => {
  const stored = localStorage.getItem(ICON_SOURCE_KEY);
  // 默认使用 npm 源，以便用户可以在设置中切换到本地文件
  return (stored as IconSource) || 'npm';
};

export const saveIconSourcePreference = (src: IconSource): void => {
  localStorage.setItem(ICON_SOURCE_KEY, src);
};

export type { IconPackName };

export interface IconPackInfo {
  name: IconPackName;
  displayName: string;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  iconCount: number;
}

export interface IconPackManagerState {
  lazyLoadingEnabled: boolean;
  enabledPacks: IconPackName[];
  packInfo: Record<string, IconPackInfo>;
  loadedIcons: Icon[];
}

// localStorage keys
const LAZY_LOADING_KEY = 'fossflow-lazy-loading-enabled';
const ENABLED_PACKS_KEY = 'fossflow-enabled-icon-packs';

// Pack metadata for known packs (others will be derived)
const PACK_METADATA: Record<string, string> = {
  isoflow: 'Core Isoflow Icons',
  aws: 'AWS Icons',
  gcp: 'Google Cloud Icons',
  azure: 'Azure Icons',
  kubernetes: 'Kubernetes Icons'
};

// Load preferences from localStorage
export const loadLazyLoadingPreference = (): boolean => {
  const stored = localStorage.getItem(LAZY_LOADING_KEY);
  return stored === null ? true : stored === 'true'; // Default to true
};

export const saveLazyLoadingPreference = (enabled: boolean): void => {
  localStorage.setItem(LAZY_LOADING_KEY, String(enabled));
};

export const loadEnabledPacks = (): IconPackName[] => {
  const stored = localStorage.getItem(ENABLED_PACKS_KEY);
  if (!stored) return ['isoflow']; // Always enable core isoflow
  try {
    const packs = JSON.parse(stored) as IconPackName[];
    // Ensure isoflow is always included
    if (!packs.includes('isoflow')) {
      packs.unshift('isoflow');
    }
    return packs;
  } catch {
    return ['isoflow'];
  }
};

export const saveEnabledPacks = (packs: IconPackName[]): void => {
  // Ensure isoflow is always included
  if (!packs.includes('isoflow')) {
    packs.unshift('isoflow');
  }
  localStorage.setItem(ENABLED_PACKS_KEY, JSON.stringify(packs));
};

/**
 * React hook for managing icon packs from file system
 * Loads icons from /icons-export directory instead of NPM packages
 */
export const useIconPackManager = () => {
  const [lazyLoadingEnabled, setLazyLoadingEnabled] = useState<boolean>(() =>
    loadLazyLoadingPreference()
  );

  const [enabledPacks, setEnabledPacks] = useState<IconPackName[]>(() =>
    loadEnabledPacks()
  );

  const [packInfo, setPackInfo] = useState<Record<string, IconPackInfo>>(() => {
    // start empty; we'll populate from index on mount
    return {} as Record<string, IconPackInfo>;
  });

  // Populate packInfo from icons index on mount
  useEffect(() => {
    const populate = async () => {
      try {
        const allIndex = await fileSystemLoader.loadIconIndex();
        const categories = Array.from(new Set(allIndex.map(i => i.category)));
        const info: Record<string, IconPackInfo> = {};
        categories.forEach(cat => {
          const display = PACK_METADATA[cat] || cat;
          const count = allIndex.filter(i => i.category === cat).length;
          info[cat] = {
            name: cat,
            displayName: display,
            loaded: false,
            loading: false,
            error: null,
            iconCount: count
          };
        });
        setPackInfo(info);
      } catch (e) {
        console.error('Failed to populate icon pack info from index:', e);
      }
    };
    populate();
  }, []);

  const [loadedIcons, setLoadedIcons] = useState<Icon[]>([]);
  const [loadedPackData, setLoadedPackData] = useState<Record<string, Icon[]>>({} as Record<string, Icon[]>);

  // Load a specific pack from file system
  const loadPack = useCallback(async (packName: IconPackName) => {
    // Already loaded?
    if (packInfo[packName]?.loaded || packInfo[packName]?.loading) {
      return loadedPackData[packName] || [];
    }

    // Set loading state
    setPackInfo(prev => ({
      ...prev,
      [packName]: { ...prev[packName], loading: true, error: null }
    }));

    try {
      const source = loadIconSourcePreference();

      if (source === 'npm') {
        // Try loading from NPM package as a fallback
        try {
          // dynamic import the pack from @isoflow/isopacks
          // pack module exports collections that flattenCollections can handle
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const packModule = await import(`@isoflow/isopacks/dist/${packName}`);
          const packDefault = packModule?.default || packModule;
          const flattened = flattenCollections([packDefault]);
          // Map to Icon interface
          const icons: Icon[] = flattened.map((it: any) => ({
            id: it.id,
            name: it.name,
            url: it.url,
            collection: packName,
            isIsometric: !!it.isIsometric
          }));

          // Store the loaded pack data
          setLoadedPackData(prev => ({ ...prev, [packName]: icons }));

          setPackInfo(prev => ({
            ...prev,
            [packName]: {
              ...prev[packName],
              name: packName,
              displayName: prev[packName]?.displayName || PACK_METADATA[packName] || packName,
              loaded: true,
              loading: false,
              iconCount: icons.length,
              error: null
            }
          }));

          setLoadedIcons(prev => {
            const newIcons = [...prev].filter(icon => icon.collection !== packName);
            return [...newIcons, ...icons];
          });

          return icons;
        } catch (npmErr) {
          console.warn(`Failed to load ${packName} from npm, falling back to filesystem:`, npmErr);
          // fallthrough to filesystem loader
        }
      }

      const icons = await fileSystemLoader.loadIconPack(packName);

      // Store the loaded pack data
      setLoadedPackData(prev => ({
        ...prev,
        [packName]: icons
      }));

      // Update pack info
      setPackInfo(prev => ({
        ...prev,
        [packName]: {
          ...prev[packName],
          name: packName,
          displayName: prev[packName]?.displayName || PACK_METADATA[packName] || packName,
          loaded: true,
          loading: false,
          iconCount: icons.length,
          error: null
        }
      }));

      // Add icons to the loaded icons array
      setLoadedIcons(prev => {
        const newIcons = [...prev];
        // Remove old icons from this pack
        const filteredIcons = newIcons.filter(icon => icon.collection !== packName);
        // Add new icons
        return [...filteredIcons, ...icons];
      });

      return icons;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load pack';
      console.error(`Failed to load ${packName} icon pack:`, error);
      setPackInfo(prev => ({
        ...prev,
        [packName]: {
          ...prev[packName],
          name: packName,
          displayName: prev[packName]?.displayName || PACK_METADATA[packName] || packName,
          loading: false,
          error: errorMessage
        }
      }));
      throw error;
    }
  }, [packInfo, loadedPackData]);

  // Enable/disable a pack
  const togglePack = useCallback(async (packName: IconPackName, enabled: boolean) => {
    if (enabled) {
      // Add to enabled packs
      const newEnabledPacks = [...enabledPacks, packName];
      setEnabledPacks(newEnabledPacks);
      saveEnabledPacks(newEnabledPacks);

      // Load the pack
      await loadPack(packName);
    } else {
      // Cannot disable core isoflow
      if (packName === 'isoflow') {
        console.warn('Cannot disable core isoflow pack');
        return;
      }

      // Remove from enabled packs
      const newEnabledPacks = enabledPacks.filter(p => p !== packName);
      setEnabledPacks(newEnabledPacks);
      saveEnabledPacks(newEnabledPacks);

      // Remove icons from loaded icons
      setLoadedIcons(prev => prev.filter(icon => icon.collection !== packName));
      
      // Update pack data
      setLoadedPackData(prev => {
        const newData = { ...prev };
        delete newData[packName];
        return newData;
      });
    }
  }, [enabledPacks, loadPack]);

  // Toggle lazy loading
  const toggleLazyLoading = useCallback((enabled: boolean) => {
    setLazyLoadingEnabled(enabled);
    saveLazyLoadingPreference(enabled);
  }, []);

  // Load all packs (for when lazy loading is disabled)
  const loadAllPacks = useCallback(async () => {
    // Discover packs from index
    const allIndex = await fileSystemLoader.loadIconIndex();
    const categories = Array.from(new Set(allIndex.map(i => i.category)));
    for (const pack of categories) {
      if (!packInfo[pack]?.loaded && !packInfo[pack]?.loading) {
        await loadPack(pack);
      }
    }
  }, [packInfo, loadPack]);

  // Auto-detect required packs from diagram data
  const loadPacksForDiagram = useCallback(async (diagramItems: any[]) => {
    if (!diagramItems || diagramItems.length === 0) return;

    // Extract unique collections from diagram items
    const collections = new Set<string>();
    diagramItems.forEach(item => {
      if (item.icon?.collection) {
        collections.add(item.icon.collection);
      }
    });

    // Load any missing packs
    const packsToLoad: IconPackName[] = [];
    collections.forEach(collection => {
      if (collection !== 'isoflow' && collection !== 'imported') {
        const packName = collection as IconPackName;
        // Allow any discovered collection to be loaded
        if (!packInfo[packName]?.loaded && !packInfo[packName]?.loading) {
          packsToLoad.push(packName);
        }
      }
    });

    // Load required packs
    for (const pack of packsToLoad) {
      await loadPack(pack);
      // Also add to enabled packs
      if (!enabledPacks.includes(pack)) {
        const newEnabledPacks = [...enabledPacks, pack];
        setEnabledPacks(newEnabledPacks);
        saveEnabledPacks(newEnabledPacks);
      }
    }
  }, [packInfo, enabledPacks, loadPack]);

  // Initialize: Load enabled packs or all packs depending on lazy loading setting
  useEffect(() => {
    const initialize = async () => {
      if (!lazyLoadingEnabled) {
        // Load all packs immediately
        await loadAllPacks();
      } else {
        // Load only enabled packs
        for (const pack of enabledPacks) {
          if (!packInfo[pack]?.loaded && !packInfo[pack]?.loading) {
            await loadPack(pack);
          }
        }
      }
    };
    initialize();
  }, []); // Only run once on mount

  return {
    lazyLoadingEnabled,
    enabledPacks,
    packInfo,
    loadedIcons,
    togglePack,
    toggleLazyLoading,
    loadAllPacks,
    loadPacksForDiagram,
    isPackEnabled: (packName: IconPackName) => enabledPacks.includes(packName),
    // expose icon source preference
    iconSource: loadIconSourcePreference(),
    setIconSource: (src: IconSource) => saveIconSourcePreference(src)
  };
};
