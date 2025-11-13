import React, { useState } from 'react';
import { Isoflow, allLocales } from 'fossflow';
import './TopologyRunView.css';

export type AppMode = 'EDITOR' | 'RUNTIME';

interface Props {
  baseDiagram: any;
  localeKey: keyof typeof allLocales;
  onBackToEditor: () => void;
}

export default function TopologyRunView({
  baseDiagram,
  localeKey,
  onBackToEditor,
}: Props) {
  // 当前运行视图使用的模型
  const [viewData, setViewData] = useState<any>(baseDiagram);
  const [traceInput, setTraceInput] = useState('');

  /**
   * 把视图中的连线改成点线：
   *   diagram.views[*].connectors[*].style = 'DOTTED'
   */
  function applyDottedLineStyle(diagram: any) {
    if (!diagram.views) return diagram;

    const newViews = (diagram.views || []).map((view: any) => {
      const newConnectors = (view.connectors || []).map((conn: any) => {
        // 这里你以后可以按需要过滤，只改某几条线
        return {
          ...conn,
          style: 'DOTTED',      // 对应 UI 里的 LINE STYLE = DOTTED
        };
      });

      return {
        ...view,
        connectors: newConnectors,
      };
    });

    return {
      ...diagram,
      views: newViews,
    };
  }

  /** 点击【查询】 */
  function onQuery() {
    if (!traceInput.trim()) {
      alert('请输入 TraceId');
      return;
    }

    console.log('查询 TraceId =', traceInput);

    // 深拷贝 baseDiagram，避免直接改原对象
    let updated = JSON.parse(JSON.stringify(baseDiagram));

    // 将 connectors 里的线改成点线
    updated = applyDottedLineStyle(updated);

    // ✅ 只更新数据，不重建组件，因此视野不会动
    setViewData(updated);
  }

  /** 点击【重置】 */
  function onReset() {
    setViewData(baseDiagram);
  }

  return (
    <div className="topology-run-container">
      {/* 顶部：标题 + TraceId 输入 */}
      <div className="topology-run-header">
        <span className="run-title">平台架构运行视图</span>

        <div className="trace-input-container">
          <span style={{ marginRight: 6 }}>TraceId:</span>
          <input
            style={{ width: 220, marginRight: 8 }}
            placeholder="请输入 TraceId..."
            value={traceInput}
            onChange={e => setTraceInput(e.target.value)}
          />
          <button onClick={onQuery}>查询</button>
          <button onClick={onReset} style={{ marginLeft: 4 }}>
            重置
          </button>

          <button
            onClick={onBackToEditor}
            style={{ marginLeft: 16 }}
          >
            返回编辑模式
          </button>
        </div>
      </div>

      {/* 中间：左图 + 右侧详情 */}
      <div className="topology-run-main">
        <div className="topology-run-left">
          <Isoflow
            initialData={viewData}
            editorMode="EDITABLE"          // 保持可操作，也方便以后做交互
            locale={allLocales[localeKey]}
          />
        </div>

        <div className="topology-run-right">
          <h3>详细信息（预留）</h3>
          <p>这里以后可以显示：</p>
          <ul>
            <li>当前选中节点的健康状态</li>
            <li>根据 TraceId 查询到的调用链路详情</li>
            <li>错误日志 / 告警信息等</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
