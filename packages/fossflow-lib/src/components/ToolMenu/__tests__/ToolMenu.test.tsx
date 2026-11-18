import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolMenu } from '../ToolMenu';
import { UiStateProvider, useUiStateStore } from 'src/stores/uiStateStore';
import { ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { LocaleProvider } from 'src/stores/localeStore';
import enUS from 'src/i18n/en-US';
import zhCN from 'src/i18n/zh-CN';
import { theme } from 'src/styles/theme';
import type { Mode } from 'src/types';

const ModeProbe = () => {
  const mode = useUiStateStore((state) => state.mode);

  return <span data-testid="mode">{mode.type}</span>;
};

const Harness = ({ initialMode }: { initialMode?: Mode }) => {
  const actions = useUiStateStore((state) => state.actions);

  useEffect(() => {
    if (initialMode) actions.setMode(initialMode);
  }, [actions, initialMode]);

  return (
    <>
      <ToolMenu />
      <ModeProbe />
    </>
  );
};

const toolMenu = (initialMode?: Mode, locale = enUS) => (
  <ThemeProvider theme={theme}>
    <LocaleProvider locale={locale}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Harness initialMode={initialMode} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </LocaleProvider>
  </ThemeProvider>
);

const selectMode = (): Mode => ({
  type: 'CURSOR',
  showCursor: true,
  mousedownItem: null
});

describe('ToolMenu（ArcMap 式工具条）', () => {
  it('平移与选择只以工具按钮出现，标题里不再带快捷键', () => {
    render(toolMenu(selectMode()));

    // 精确匹配：若标题被拼成 "Pan tool (W)" 这里就会失败
    expect(screen.getByRole('button', { name: 'Pan tool' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Select tool' })).toBeTruthy();
  });

  it('工具选中后保持激活，直到从工具条切换到另一个工具', async () => {
    const user = userEvent.setup();

    render(toolMenu(selectMode()));

    await user.click(screen.getByRole('button', { name: 'Pan tool' }));
    expect(screen.getByTestId('mode').textContent).toBe('PAN');

    await user.click(screen.getByRole('button', { name: 'Select tool' }));
    expect(screen.getByTestId('mode').textContent).toBe('CURSOR');
  });

  it('语言切换时更新工具提示和无障碍名称，并显示当前快捷键', () => {
    const { rerender } = render(toolMenu(selectMode(), zhCN));

    expect(screen.getByRole('button', { name: '连线工具 (C)' })).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(8);

    rerender(toolMenu(selectMode(), enUS));

    expect(screen.getByRole('button', { name: 'Connector tool (C)' })).toBeTruthy();
  });
});
