/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackendArchitectureDialog } from '../../../components/BackendArchitectureDialog/BackendArchitectureDialog';
import type { ArchitectureStorageClient } from '../../../services/architectureStorage';
import type { DiagramData } from '../../../diagramUtils';

jest.mock('fossflow', () => ({
  lockCanvasInteractions: jest.fn(),
  unlockCanvasInteractions: jest.fn()
}));

const diagram = {
  title: 'MSC',
  icons: [],
  colors: [],
  items: [{ id: 'svc.msc-gateway', name: 'msc-gateway', icon: 'router' }],
  views: [{ id: 'v1', name: 'main', items: [], connectors: [] }],
  fitToView: true
} as unknown as DiagramData;

const makeClient = () => ({
  create: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  list: jest.fn(),
  load: jest.fn()
});

const renderDialog = (
  client: ReturnType<typeof makeClient>,
  overrides: Partial<React.ComponentProps<typeof BackendArchitectureDialog>> = {}
) => {
  const onClose = jest.fn();
  const onSaved = jest.fn();
  const onLoaded = jest.fn();

  render(
    <BackendArchitectureDialog
      mode="save"
      client={client as unknown as ArchitectureStorageClient}
      currentId={null}
      defaultTitle="MSC 架构"
      diagram={diagram}
      onClose={onClose}
      onSaved={onSaved}
      onLoaded={onLoaded}
      {...overrides}
    />
  );

  return { onClose, onSaved, onLoaded };
};

describe('BackendArchitectureDialog', () => {
  it('首次保存使用 POST（save 传入 null），成功后回调保存结果', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    const record = { id: 'arch-1', title: 'MSC 架构', diagram };
    client.save.mockResolvedValue(record);

    const { onSaved } = renderDialog(client);

    await user.click(screen.getByRole('button', { name: '保存到后台' }));

    expect(client.save).toHaveBeenCalledWith(null, 'MSC 架构', diagram);
    expect(onSaved).toHaveBeenCalledWith(record);
  });

  it('已关联架构时默认更新同一 ID，也可另存为新架构', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    client.save.mockResolvedValue({ id: 'arch-9', title: 'MSC 架构', diagram });

    renderDialog(client, { currentId: 'arch-9' });

    await user.click(screen.getByRole('button', { name: '更新后台架构' }));
    expect(client.save).toHaveBeenLastCalledWith('arch-9', 'MSC 架构', diagram);

    await user.click(screen.getByRole('button', { name: '另存为新架构' }));
    expect(client.save).toHaveBeenLastCalledWith(null, 'MSC 架构', diagram);
  });

  it('加载模式列出后台架构，选中后按 ID 读取并回调', async () => {
    const user = userEvent.setup();
    const client = makeClient();
    const record = { id: 'arch-7', title: '已有架构', diagram };

    client.list.mockResolvedValue([
      { id: 'arch-7', title: '已有架构', updatedAt: '2026-11-14T12:00:00Z' }
    ]);
    client.load.mockResolvedValue(record);

    const { onLoaded } = renderDialog(client, { mode: 'load' });

    expect(await screen.findByText('已有架构')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '加载' }));

    expect(client.load).toHaveBeenCalledWith('arch-7');
    expect(onLoaded).toHaveBeenCalledWith(record);
  });

  it('保存失败时把后端错误显示出来，而不是静默关闭', async () => {
    const user = userEvent.setup();
    const client = makeClient();

    client.save.mockRejectedValue(new Error('后台架构服务返回 500'));

    const { onSaved } = renderDialog(client);

    await user.click(screen.getByRole('button', { name: '保存到后台' }));

    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toContain('后台架构服务返回 500');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('空标题直接拒绝，不调用后端', async () => {
    const user = userEvent.setup();
    const client = makeClient();

    renderDialog(client, { defaultTitle: '   ' });

    await user.click(screen.getByRole('button', { name: '保存到后台' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('架构标题');
    });
    expect(client.save).not.toHaveBeenCalled();
  });
});
