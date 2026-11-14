import { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { allLocales } from 'fossflow';
import { useTranslation } from 'react-i18next';
import TopologyRunView from '../components/TopologyRunView';
import { useDiagramSource } from '../hooks/useDiagramSource';
import { createMockRuntimeDataSource } from '../services/runtime/mockRuntimeDataSource';
import { createHttpRuntimeDataSource } from '../services/runtime/httpRuntimeDataSource';
import { ROUTES, RUNTIME_SEARCH_PARAMS } from '../routes';

/**
 * 运行视图独立页面。
 * 通过 /runtime 直接访问时，从 diagramId 参数或“最近打开的图表”恢复数据。
 */
export default function RuntimePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation('app');
  const [searchParams] = useSearchParams();
  const diagramId = searchParams.get(RUNTIME_SEARCH_PARAMS.diagramId);

  const { sanitizedDiagram, iconPackManager } = useDiagramSource(diagramId);

  /**
   * `sanitizeDiagram` 每次都会生成新的 items 数组，若直接作为依赖会导致
   * dataSource 反复重建并触发运行视图重复拉取。这里按内容指纹复用。
   * tag 参与指纹，因为它决定节点与后端 tag_id 的映射。
   */
  const itemsKey = useMemo(() => {
    return (sanitizedDiagram.items ?? [])
      .map((item: any) => `${item.id}:${item.name ?? ''}:${item.tag ?? ''}`)
      .join('|');
  }, [sanitizedDiagram]);

  const runtimeDataSource = useMemo(() => {
    const items = (sanitizedDiagram.items ?? []) as Array<{
      id: string;
      name?: string;
      tag?: string;
    }>;

    const normalized = items.map((item) => ({
      id: item.id,
      name: item.name,
      tag: item.tag
    }));

    // 优先走后端接口；后端不可用时自动回退到本地 mock
    return createHttpRuntimeDataSource({
      items: normalized,
      fallback: createMockRuntimeDataSource({ items: normalized })
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  // 标题反映当前页面，便于多标签页区分
  useEffect(() => {
    const previousTitle = document.title;

    document.title = `${sanitizedDiagram.title || 'Untitled Diagram'} · 运行视图`;

    return () => {
      document.title = previousTitle;
    };
  }, [sanitizedDiagram.title]);

  if (!iconPackManager.isInitialLoadComplete) {
    return <div className="fossflow-loading">正在加载图标资源…</div>;
  }

  return (
    <TopologyRunView
      baseDiagram={sanitizedDiagram}
      localeKey={i18n.language as keyof typeof allLocales}
      dataSource={runtimeDataSource}
      onBackToEditor={() => navigate(ROUTES.editor)}
    />
  );
}
