import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomControls } from '../ZoomControls';
import { UiStateProvider, useUiStateStore } from 'src/stores/uiStateStore';
import { ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { theme } from 'src/styles/theme';
import type { Mode } from 'src/types';

const Probe = () => {
  const mode = useUiStateStore((state) => state.mode);
  const zoom = useUiStateStore((state) => state.zoom);

  return (
    <>
      <span data-testid="mode">{mode.type}</span>
      <span data-testid="zoom">{zoom}</span>
    </>
  );
};

const Harness = ({
  initialMode,
  isRuntime
}: {
  initialMode?: Mode;
  isRuntime?: boolean;
}) => {
  const actions = useUiStateStore((state) => state.actions);

  useEffect(() => {
    if (initialMode) actions.setMode(initialMode);
  }, [actions, initialMode]);

  return (
    <>
      <ZoomControls isRuntime={isRuntime} />
      <Probe />
    </>
  );
};

const renderZoomControls = (initialMode?: Mode, isRuntime = false) =>
  render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Harness initialMode={initialMode} isRuntime={isRuntime} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

const panMode: Mode = { type: 'PAN', showCursor: false };

describe('ZoomControls（Command 语义）', () => {
  it('编辑器不再重复提供平移/选择工具，只保留视图命令', () => {
    renderZoomControls(panMode);

    expect(screen.getByRole('button', { name: 'Zoom in (command)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zoom out (command)' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Fit to view (command)' })
    ).toBeTruthy();

    expect(screen.queryByRole('button', { name: 'Pan tool' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select tool' })).toBeNull();
  });

  it('执行命令后当前工具保持不变（PAN 仍是 PAN）', async () => {
    const user = userEvent.setup();

    renderZoomControls(panMode);

    const zoomBefore = Number(screen.getByTestId('zoom').textContent);
    // 初始缩放在 MAX_ZOOM(1)，因此用缩小命令验证「命令执行一次」且不影响工具
    await user.click(screen.getByRole('button', { name: 'Zoom out (command)' }));

    expect(Number(screen.getByTestId('zoom').textContent)).toBeLessThan(
      zoomBefore
    );
    expect(screen.getByTestId('mode').textContent).toBe('PAN');
  });

  it('运行视图保留进入 RUNTIME CURSOR 的入口', async () => {
    const user = userEvent.setup();

    renderZoomControls(panMode, true);

    await user.click(screen.getByRole('button', { name: 'Select tool' }));

    expect(screen.getByTestId('mode').textContent).toBe('RUNTIME CURSOR');
  });
});
