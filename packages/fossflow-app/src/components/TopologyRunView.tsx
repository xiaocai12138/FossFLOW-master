import React, { useState, useEffect } from 'react';
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
  // 当前运行视图使用的模型（初次进入自动全图）
  const [viewData, setViewData] = useState<any>(() => ({
    ...baseDiagram,
    fitToScreen: true,
  }));

  const [traceInput, setTraceInput] = useState('');

  // 当 baseDiagram 变化时重新全图
  useEffect(() => {
    setViewData({
      ...baseDiagram,
      fitToScreen: true,
    });
  }, [baseDiagram]);

  /**
   * 把所有 connectors 改成点线
   */
  function applyDottedLineStyle(diagram: any) {
    if (!diagram.views) return diagram;

    const newViews = (diagram.views || []).map((view: any) => {
      const newConnectors = (view.connectors || []).map((conn: any) => ({
        ...conn,
        style: 'DOTTED',
      }));

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

    let updated = JSON.parse(JSON.stringify(baseDiagram));

    updated = applyDottedLineStyle(updated);

    updated.fitToScreen = false; // 查询时不自动全图

    setViewData(updated);
  }

  /** 点击【重置】 */
  function onReset() {
    setViewData({
      ...baseDiagram,
      fitToScreen: false,
    });
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
            onChange={(e) => setTraceInput(e.target.value)}
          />
          <button onClick={onQuery}>查询</button>
          <button onClick={onReset} style={{ marginLeft: 4 }}>
            重置
          </button>

          <button onClick={onBackToEditor} style={{ marginLeft: 16 }}>
            返回编辑模式
          </button>
        </div>
      </div>

      {/* 中间：左图 + 右侧详情 */}
      <div className="topology-run-main">
        <div className="topology-run-left">
          <Isoflow
            initialData={viewData}
            editorMode="EXPLORABLE_READONLY"
            locale={allLocales[localeKey]}
          />
        </div>

        <div className="topology-run-right">
          <h3>详细信息（预留）</h3>
          <p>这里以后可以展示：</p>
          <ul>
            <li>节点健康状态</li>
            <li>TraceId 调用链路详情</li>
            <li>错误日志 / 告警信息</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
