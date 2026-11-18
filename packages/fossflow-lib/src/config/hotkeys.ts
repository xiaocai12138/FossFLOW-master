export type HotkeyProfile = 'qwerty' | 'smnrct' | 'none';

export interface HotkeyMapping {
  select: string | null;
  pan: string | null;
  addItem: string | null;
  rectangle: string | null;
  connector: string | null;
  text: string | null;
  lasso: string | null;
  freehandLasso: string | null;
}

export const HOTKEY_PROFILES: Record<HotkeyProfile, HotkeyMapping> = {
  // ArcMap 式交互：平移与选择是工具，只能从工具条选择，因此不分配快捷键。
  qwerty: {
    select: null,
    pan: null,
    addItem: 'e',
    rectangle: 'r',
    connector: 't',
    text: 'y',
    lasso: 'l',
    freehandLasso: 'f'
  },
  smnrct: {
    select: null,
    pan: null,
    addItem: 'n',
    rectangle: 'r',
    connector: 'c',
    text: 't',
    lasso: 'l',
    freehandLasso: 'f'
  },
  none: {
    select: null,
    pan: null,
    addItem: null,
    rectangle: null,
    connector: null,
    text: null,
    lasso: null,
    freehandLasso: null
  }
};

export const DEFAULT_HOTKEY_PROFILE: HotkeyProfile = 'smnrct';