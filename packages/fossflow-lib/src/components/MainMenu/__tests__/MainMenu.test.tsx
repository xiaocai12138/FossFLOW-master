import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MainMenu } from '../MainMenu';
import { UiStateProvider, useUiStateStore } from 'src/stores/uiStateStore';
import { ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { theme } from 'src/styles/theme';
import type {
  CustomMainMenuAction,
  CustomMainMenuConfig
} from 'src/types/isoflowProps';

const action = (
  id: string,
  label: string,
  onClick: () => void = jest.fn()
): CustomMainMenuAction => ({ id, label, onClick });

/** 用真实的 Provider 包裹，把自定义菜单配置注入 uiStateStore */
const Harness = ({ config }: { config: CustomMainMenuConfig }) => {
  const actions = useUiStateStore((state) => state.actions);

  useEffect(() => {
    actions.setMainMenuOptions([]);
    actions.setCustomMainMenu(config);
  }, [actions, config]);

  return <MainMenu />;
};

const renderMenu = (config: CustomMainMenuConfig) => {
  return render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Harness config={config} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );
};

const openMainMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Main menu' }));
};

describe('MainMenu 二级菜单', () => {
  it('展开「APM 架构」后显示第二级业务入口', async () => {
    const user = userEvent.setup();

    renderMenu({
      actions: [action('new-diagram', '新建图表')],
      groups: [
        {
          id: 'apm-architecture',
          label: 'APM 架构',
          actions: [
            action('import-topology', '导入服务拓扑'),
            action('save-architecture', '保存后台架构'),
            action('load-architecture', '加载后台架构'),
            action('run-view', '进入运行视图')
          ]
        }
      ]
    });

    await openMainMenu(user);

    // 一级菜单里只有分组标题，业务动作此时不可见
    expect(screen.queryByRole('menuitem', { name: '保存后台架构' })).toBeNull();

    await user.click(screen.getByRole('menuitem', { name: 'APM 架构' }));

    expect(
      await screen.findByRole('menuitem', { name: '导入服务拓扑' })
    ).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '保存后台架构' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '加载后台架构' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: '进入运行视图' })).toBeTruthy();
  });

  it('点击第二级动作会执行回调并关闭两层菜单', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn();

    renderMenu({
      actions: [],
      groups: [
        {
          id: 'apm-architecture',
          label: 'APM 架构',
          actions: [action('save-architecture', '保存后台架构', onSave)]
        }
      ]
    });

    await openMainMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'APM 架构' }));
    await user.click(await screen.findByRole('menuitem', { name: '保存后台架构' }));

    expect(onSave).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        screen.queryByRole('menuitem', { name: 'APM 架构' })
      ).toBeNull();
      expect(
        screen.queryByRole('menuitem', { name: '保存后台架构' })
      ).toBeNull();
    });
  });

  it('Tab 在菜单内部循环，键盘可以到达「APM 架构」入口', async () => {
    const user = userEvent.setup();

    renderMenu({
      actions: [action('new-diagram', '新建图表')],
      groups: [
        {
          id: 'apm-architecture',
          label: 'APM 架构',
          actions: [action('save-architecture', '保存后台架构')]
        }
      ]
    });

    await openMainMenu(user);
    await waitFor(() => {
      expect(document.activeElement?.getAttribute('role')).toBe('menuitem');
    });

    const menu = screen.getByRole('menu');
    let reached = false;

    for (let i = 0; i < 15; i += 1) {
      if ((document.activeElement?.textContent || '').includes('APM 架构')) {
        reached = true;
        break;
      }

      fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' });
    }

    expect(reached).toBe(true);
    // 焦点不能跑出菜单
    expect(menu.contains(document.activeElement)).toBe(true);
  });

  it('未配置 groups 时保持原来的平铺动作，不出现二级菜单', async () => {
    const user = userEvent.setup();

    renderMenu({ actions: [action('new-diagram', '新建图表')] });

    await openMainMenu(user);

    expect(screen.queryByRole('menuitem', { name: 'APM 架构' })).toBeNull();
    expect(screen.getByRole('button', { name: '新建图表' })).toBeTruthy();
  });
});

it('uses action section metadata to place file commands and settings before the first divider', () => {
  const fileAction = { ...action('manage', 'Manage diagrams'), section: 'file' } as const;
  const topologyAction = action('topology', 'Import topology');

  renderMenu({ actions: [topologyAction, fileAction] });
  fireEvent.click(screen.getByRole('button', { name: 'Main menu' }));

  const menu = within(screen.getByRole('menu'));
  const firstDivider = menu.getAllByRole('separator')[0];
  const isBeforeDivider = (element: HTMLElement) =>
    Boolean(element.compareDocumentPosition(firstDivider) & Node.DOCUMENT_POSITION_FOLLOWING);

  const command = menu.getByRole('menuitem', { name: 'Manage diagrams' });
  expect(isBeforeDivider(command)).toBe(true);
  expect(isBeforeDivider(menu.getByRole('menuitem', { name: 'Settings' }))).toBe(true);
  expect(isBeforeDivider(menu.getByRole('button', { name: 'Import topology' }))).toBe(false);
  expect(menu.queryByRole('menuitem', { name: 'Undo' })).toBeNull();
  expect(menu.queryByRole('menuitem', { name: 'Redo' })).toBeNull();

  fireEvent.click(command);
  expect(fileAction.onClick).toHaveBeenCalledTimes(1);
});
