import type { DiagramData } from '../../diagramUtils';
import { buildDiagram } from './diagramBuilder';
import { fetchCatalog } from './fetchCatalog';
import { layoutNodes } from './layout';
import type { ImportOptions, ImportPreview } from './types';

export type {
  Health,
  ImportOptions,
  ImportPreview,
  NodeKind,
  RegistryCatalog,
  RegistryEdge,
  RegistryInstance,
  RegistryNode,
  RegistrySourceInfo
} from './types';
export { fetchCatalog, fetchSources } from './fetchCatalog';
export { iconForKind } from './iconMapping';
export { layoutNodes } from './layout';
export { buildDiagram } from './diagramBuilder';
export { normalizeCatalog } from './normalize';

/**
 * 拉取并解析，只返回校验后的清单给 UI 预览，不生成图。
 */
export const previewImport = async (
  url: string,
  _opts: ImportOptions = {}
): Promise<ImportPreview> => {
  const catalog = await fetchCatalog(url);

  return {
    catalog,
    nodes: catalog.nodes,
    edges: catalog.edges,
    warnings: [...(catalog.warnings ?? [])]
  };
};

/**
 * 拉取 → 布局 → 生成图。
 *
 * 返回完整 diagram 而不是直接写画布，让对话框可以先预览再落盘；
 * `replace` 由调用方决定，这里不涉及画布状态。
 */
export const importTopology = async (
  url: string,
  opts: ImportOptions = {}
): Promise<{ diagram: DiagramData; warnings: string[] }> => {
  const preview = await previewImport(url, opts);
  const { catalog } = preview;

  const layout = layoutNodes(catalog.nodes, catalog.edges, {
    columnStep: opts.columnStep,
    rowStep: opts.rowStep
  });

  const diagram = buildDiagram(catalog, layout, {
    includeInstances: opts.includeInstances,
    title: '服务拓扑'
  });

  const warnings = [...preview.warnings];

  if (catalog.edges.length === 0) {
    warnings.push('清单不含调用关系，节点按网格排布');
  }

  return { diagram, warnings };
};

export default importTopology;
