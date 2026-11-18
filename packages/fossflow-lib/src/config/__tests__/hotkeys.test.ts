import { HOTKEY_PROFILES } from '../hotkeys';

/**
 * ArcMap 式交互约束：平移与选择只能从工具条选择，
 * 因此任何快捷键配置都不得给它们分配按键（否则可通过键盘绕过工具条）。
 */
describe('hotkey profiles', () => {
  it.each(['qwerty', 'smnrct', 'none'] as const)(
    '%s 不为平移/选择分配快捷键',
    (profile) => {
      expect(HOTKEY_PROFILES[profile].select).toBeNull();
      expect(HOTKEY_PROFILES[profile].pan).toBeNull();
    }
  );

  it('其它工具保留快捷键，避免功能退化', () => {
    expect(HOTKEY_PROFILES.smnrct.addItem).toBe('n');
    expect(HOTKEY_PROFILES.smnrct.connector).toBe('c');
    expect(HOTKEY_PROFILES.qwerty.rectangle).toBe('r');
  });
});
