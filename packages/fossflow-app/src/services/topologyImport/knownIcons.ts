/**
 * 仓库内已随构建发布的真实图标资源。
 *
 * 与 `fallbackIcons` 的区别：这里每条都对应 `icons-export/` 下真实存在的 SVG，
 * 由静态资源服务直接提供（不打 data URL），因此节点能保留等距造型。
 * 只有 id 不在这张表里时才退回到内联兜底图形。
 *
 * 维护要求：新增条目必须能在 `icons-export/icons-index.json` 里查到，
 * 且 url 与索引中的路径逐字一致；写错会让节点渲染成空白方块。
 */
export interface KnownIcon {
  id: string;
  name: string;
  url: string;
  collection: string;
  isIsometric: boolean;
}

const KNOWN_ICONS: Record<string, KnownIcon> = {
  // 网关：APIGateway 的实际资源是紫色立方体，经视觉核验后改用 router
  router: {
    id: 'router',
    name: 'router',
    url: '/icons-export/isoflow/router.svg',
    collection: 'isoflow',
    isIsometric: true
  },
  block: {
    id: 'block',
    name: 'block',
    url: '/icons-export/isoflow/block.svg',
    collection: 'isoflow',
    isIsometric: true
  },
  cube: {
    id: 'cube',
    name: 'cube',
    url: '/icons-export/isoflow/cube.svg',
    collection: 'isoflow',
    isIsometric: true
  },
  cache: {
    id: 'cache',
    name: 'cache',
    url: '/icons-export/isoflow/cache.svg',
    collection: 'isoflow',
    isIsometric: true
  },
  queue: {
    id: 'queue',
    name: 'queue',
    url: '/icons-export/isoflow/queue.svg',
    collection: 'isoflow',
    isIsometric: true
  },
  cloud: {
    id: 'cloud',
    name: 'cloud',
    url: '/icons-export/isoflow/cloud.svg',
    collection: 'isoflow',
    isIsometric: true
  }
};

/** 查询已发布的真实图标；未知 id 返回 undefined，由调用方决定兜底策略 */
export const knownIconFor = (iconId: string): KnownIcon | undefined => {
  const icon = KNOWN_ICONS[iconId];

  return icon ? { ...icon } : undefined;
};

export const KNOWN_ICON_IDS: string[] = Object.keys(KNOWN_ICONS);

export default knownIconFor;
