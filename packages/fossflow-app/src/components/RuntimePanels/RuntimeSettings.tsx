import React, { useState } from 'react';
import { DraggableModal } from '../DraggableModal/DraggableModal';
import { LOG_LEVELS } from '../../services/runtime/types';
import {
  DEFAULT_LOG_COLORS,
  isValidNodeStatusRefreshSeconds,
  MAX_NODE_STATUS_REFRESH_SECONDS
} from '../../services/runtime/runtimeViewConfig';
import type { RuntimeViewConfig } from '../../services/runtime/runtimeViewConfig';

interface Props {
  config: RuntimeViewConfig;
  onChange: (config: RuntimeViewConfig) => void;
  onClose: () => void;
}

export function RuntimeSettings({ config, onChange, onClose }: Props) {
  const [interval, setInterval] = useState(String(config.nodeStatusRefreshSeconds));
  const intervalSeconds = Number(interval);

  return (
    <DraggableModal
      title="运行视图设置"
      width={900}
      panelClassName="rt-settings-panel"
      bodyClassName="rt-settings-body"
      onClose={onClose}
      allowCanvasInteraction
    >
      <fieldset className="rt-settings-section">
        <legend>节点状态</legend>
        <form
          className="rt-refresh-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isValidNodeStatusRefreshSeconds(intervalSeconds)) return;
            onChange({ ...config, nodeStatusRefreshSeconds: intervalSeconds });
          }}
        >
          <label className="rt-refresh-interval">
            <span>节点状态刷新间隔（秒）</span>
            <input
              type="number"
              min={1}
              max={MAX_NODE_STATUS_REFRESH_SECONDS}
              step={1}
              required
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="rt-btn rt-btn-primary"
            disabled={intervalSeconds === config.nodeStatusRefreshSeconds}
          >
            应用
          </button>
        </form>
      </fieldset>
      <fieldset className="rt-settings-section">
        <legend>日志颜色</legend>
        <div className="rt-log-color-grid">
          {LOG_LEVELS.map((level) => (
            <label key={level} className="rt-log-color">
              <input
                type="color"
                aria-label={level}
                value={config.logColors[level]}
                onChange={(event) => onChange({
                  ...config,
                  logColors: { ...config.logColors, [level]: event.target.value }
                })}
              />
              <span>{level}</span>
              <code aria-hidden="true">{config.logColors[level]}</code>
            </label>
          ))}
        </div>
        <div className="rt-settings-actions">
          <button
            type="button"
            className="rt-btn rt-btn-ghost"
            onClick={() => onChange({ ...config, logColors: { ...DEFAULT_LOG_COLORS } })}
          >
            恢复默认颜色
          </button>
        </div>
      </fieldset>
    </DraggableModal>
  );
}
