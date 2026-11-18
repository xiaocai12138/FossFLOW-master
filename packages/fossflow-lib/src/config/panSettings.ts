/**
 * @deprecated 自 2026-11-14 起采用 ArcMap 式交互：平移只能由工具条的 PAN 工具触发，
 * 中键/右键/空白处拖动/方向键等隐式平移已全部移除。
 *
 * 本类型与默认值仅为兼容旧的 UI 状态字段而保留，画布不再读取它；
 * 默认值全部关闭，避免任何残留路径意外重新启用隐式平移。
 */
export interface PanSettings {
  // Mouse pan options
  middleClickPan: boolean;
  rightClickPan: boolean;
  ctrlClickPan: boolean;
  altClickPan: boolean;
  emptyAreaClickPan: boolean;
  
  // Keyboard pan options
  arrowKeysPan: boolean;
  wasdPan: boolean;
  ijklPan: boolean;
  
  // Pan speed
  keyboardPanSpeed: number;
}

export const DEFAULT_PAN_SETTINGS: PanSettings = {
  middleClickPan: false,
  rightClickPan: false,
  ctrlClickPan: false,
  altClickPan: false,
  emptyAreaClickPan: false,
  arrowKeysPan: false,
  wasdPan: false,
  ijklPan: false,
  keyboardPanSpeed: 20
};