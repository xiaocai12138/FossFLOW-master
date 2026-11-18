/**
 * 前端路由常量。编辑视图与运行视图使用独立地址，便于页面集成与外链分享。
 */
export const ROUTES = {
  editor: '/editor',
  runtime: '/runtime',
  root: '/'
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** 进入运行视图时可携带的查询参数 */
export const RUNTIME_SEARCH_PARAMS = {
  traceId: 'traceId',
  diagramId: 'diagramId',
  /** 后台保存的架构 id：运行页优先按它从服务器读取 */
  architectureId: 'architectureId'
} as const;
