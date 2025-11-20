/**
 * 文件系统图标加载器
 * 从 icons-export 目录加载图标，而不是从 NPM 包导入
 * 支持按需加载、缓存等功能
 */

export type IconPackName = string;

export interface Icon {
  id: string;
  name: string;
  url: string;
  collection: IconPackName;
  isIsometric?: boolean;
}

export interface IconIndex {
  id: string;
  name: string;
  category: string;
  path: string;
}

// 缓存已加载的图标索引
const iconIndexCache = new Map<string, IconIndex[]>();
// 缓存已加载的图标数据
const iconDataCache = new Map<string, Icon>();

/**
 * 加载图标索引文件 (icons-export/icons-index.json)
 */
export const loadIconIndex = async (): Promise<IconIndex[]> => {
  try {
    const response = await fetch('/icons-export/icons-index.json');
    if (!response.ok) {
      throw new Error(`Failed to load icon index: ${response.statusText}`);
    }
    const data: IconIndex[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error loading icon index:', error);
    return [];
  }
};

/**
 * 加载特定分类的图标
 */
export const loadIconPack = async (packName: IconPackName): Promise<Icon[]> => {
  try {
    // 检查缓存
    if (iconIndexCache.has(packName)) {
      const indexList = iconIndexCache.get(packName)!;
      const icons: Icon[] = [];
      
      for (const index of indexList) {
        const cachedIcon = iconDataCache.get(index.id);
        if (cachedIcon) {
          icons.push(cachedIcon);
        } else {
          // 加载 SVG 文件
          const iconUrl = `/icons-export/${index.path}`;
          const icon: Icon = {
            id: index.id,
            name: index.name,
            url: iconUrl,
            collection: packName,
            isIsometric: true
          };
          icons.push(icon);
          iconDataCache.set(index.id, icon);
        }
      }
      return icons;
    }

    // 首次加载，获取索引
    const allIcons = await loadIconIndex();
    const packIcons = allIcons.filter(icon => icon.category === packName);
    
    // 缓存索引
    iconIndexCache.set(packName, packIcons);
    
    // 构建图标对象
    const icons: Icon[] = packIcons.map(index => {
      const iconUrl = `/icons-export/${index.path}`;
      const icon: Icon = {
        id: index.id,
        name: index.name,
        url: iconUrl,
        collection: packName,
        isIsometric: true
      };
      iconDataCache.set(index.id, icon);
      return icon;
    });

    return icons;
  } catch (error) {
    console.error(`Error loading icon pack ${packName}:`, error);
    return [];
  }
};

/**
 * 加载所有图标
 */
export const loadAllIconPacks = async (): Promise<Icon[]> => {
  // Load all icons by discovering categories from the index
  const allIndex = await loadIconIndex();
  const categories = Array.from(new Set(allIndex.map(i => i.category)));
  const allIcons: Icon[] = [];

  for (const pack of categories) {
    const icons = await loadIconPack(pack);
    allIcons.push(...icons);
  }

  return allIcons;
};

/**
 * 加载核心图标 (isoflow + 其他必需的图标)
 * 用于快速初始化
 */
export const loadCoreIcons = async (): Promise<Icon[]> => {
  return loadIconPack('isoflow');
};

/**
 * 按 ID 查找单个图标
 */
export const findIconById = async (iconId: string): Promise<Icon | null> => {
  // 检查缓存
  if (iconDataCache.has(iconId)) {
    return iconDataCache.get(iconId) || null;
  }

  // 从索引查找
  const allIcons = await loadIconIndex();
  const iconIndex = allIcons.find(icon => icon.id === iconId);
  
  if (!iconIndex) {
    return null;
  }

  const icon: Icon = {
    id: iconIndex.id,
    name: iconIndex.name,
    url: `/icons-export/${iconIndex.path}`,
    collection: iconIndex.category,
    isIsometric: true
  };

  iconDataCache.set(iconId, icon);
  return icon;
};

/**
 * 搜索图标 (按名称)
 */
export const searchIcons = async (query: string): Promise<Icon[]> => {
  const allIcons = await loadIconIndex();
  const lowerQuery = query.toLowerCase();
  
  const results = allIcons
    .filter(icon => 
      icon.id.toLowerCase().includes(lowerQuery) || 
      icon.name.toLowerCase().includes(lowerQuery)
    )
    .map(index => ({
      id: index.id,
      name: index.name,
      url: `/icons-export/${index.path}`,
      collection: index.category,
      isIsometric: true
    }));

  return results;
};

/**
 * 获取特定分类的统计信息
 */
export const getIconPackStats = async (): Promise<Record<string, number>> => {
  const allIcons = await loadIconIndex();
  const stats: Record<string, number> = {};

  allIcons.forEach(icon => {
    stats[icon.category] = (stats[icon.category] || 0) + 1;
  });

  return stats;
};

/**
 * 清空所有缓存
 * 用于测试或需要刷新图标数据的场景
 */
export const clearIconCache = (): void => {
  iconIndexCache.clear();
  iconDataCache.clear();
};
