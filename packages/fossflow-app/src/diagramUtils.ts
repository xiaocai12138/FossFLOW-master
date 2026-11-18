// Utility functions for handling diagram data

export interface DiagramData {
  title: string;
  version?: string;
  description?: string;
  icons: any[];
  colors: any[];
  items: any[];
  views: any[];
  fitToView?: boolean;
  fitToScreen?: boolean;
}

// Deep merge two objects, with special handling for arrays
export function mergeDiagramData(base: DiagramData, update: Partial<DiagramData>): DiagramData {
  return {
    title: update.title !== undefined ? update.title : base.title,
    version: update.version !== undefined ? update.version : base.version,
    description: update.description !== undefined ? update.description : base.description,
    // For arrays, completely replace if provided, otherwise keep base
    icons: update.icons !== undefined ? update.icons : base.icons,
    colors: update.colors !== undefined ? update.colors : base.colors,
    items: update.items !== undefined ? update.items : base.items,
    views: update.views !== undefined ? update.views : base.views,
    fitToView: update.fitToView !== undefined ? update.fitToView : base.fitToView,
    fitToScreen: update.fitToScreen !== undefined ? update.fitToScreen : base.fitToScreen
  };
}

// Extract only the data that should be saved/exported
export function extractSavableData(fullData: DiagramData): DiagramData {
  return {
    title: fullData.title,
    version: fullData.version,
    description: fullData.description,
    // Only include non-empty arrays
    icons: fullData.icons || [],
    colors: fullData.colors || [],
    items: (fullData.items || []).map((it: any) => {
      if (it && typeof it === 'object') {
        return { ...it, tag: typeof it.tag === 'string' ? it.tag : '' };
      }
      return it;
    }),
    views: fullData.views || [],
    fitToView: fullData.fitToView,
    fitToScreen: fullData.fitToScreen !== false
  };
}

// Validate diagram data structure
export function validateDiagramData(data: any): data is DiagramData {
  return (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray(data.icons) &&
    Array.isArray(data.colors) &&
    Array.isArray(data.items) &&
    Array.isArray(data.views)
  );
}
