/** @jest-environment jsdom */

import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { lockCanvasInteractions } from 'fossflow';
import TopologyRunView from '../../../components/TopologyRunView';
import type { RuntimeDataSource, ServiceLog, ServiceState, TraceDetail } from '../../runtime/types';
import { loadRuntimeViewConfig } from '../../runtime/runtimeViewConfig';

jest.mock('fossflow', () => ({
  allLocales: { 'zh-CN': {} },
  lockCanvasInteractions: jest.fn(),
  unlockCanvasInteractions: jest.fn(),
  Isoflow: ({ runtimeOverlay, onRuntimeActionEvent }: any) => (
    <>
      <output data-testid="focused-node">{runtimeOverlay.focusedItemId}</output>
      <output data-testid="trace-links">{Object.keys(runtimeOverlay.connectorReveal).join(',')}</output>
      <output data-testid="trace-steps">{Object.keys(runtimeOverlay.traceStepNumbersByItemId).join(',')}</output>
      <button onClick={() => onRuntimeActionEvent({ item: { id: 'gateway' } })}>
        选择网关
      </button>
      <button onClick={() => onRuntimeActionEvent({ item: { id: 'business' } })}>
        选择业务服务
      </button>
      <button onClick={() => onRuntimeActionEvent({ item: { id: 'unmonitored' } })}>
        选择未监控节点
      </button>
    </>
  )
}));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

const diagram = {
  items: [
    { id: 'gateway', name: 'Gateway' },
    { id: 'business', name: 'Business' },
    { id: 'unmonitored', name: 'Unmonitored' }
  ],
  views: [{
    items: [{ id: 'gateway' }, { id: 'business' }, { id: 'unmonitored' }],
    connectors: [{
      id: 'gateway-business',
      anchors: [{ ref: { item: 'gateway' } }, { ref: { item: 'business' } }]
    }]
  }]
};

const services: ServiceState[] = diagram.items.slice(0, 2).map(({ id, name }, index) => ({
  itemId: id,
  name,
  status: index === 0 ? 'HEALTHY' : 'WARNING',
  version: '1.2.3',
  metrics: {
    cpu: index === 0 ? 24 : 80,
    memory: 50,
    latencyP95Ms: 120,
    qps: 433,
    errorRate: 0,
    uptimeSeconds: 3600
  }
}));

const trace: TraceDetail = {
  traceId: 'trace-a',
  startedAt: '2026-11-18T08:00:00Z',
  totalDurationMs: 100,
  entryService: 'Gateway',
  spans: services.map(({ itemId, name }, index) => ({
    itemId,
    serviceName: name,
    spanId: itemId,
    operation: 'GET /orders',
    startMs: index * 20,
    durationMs: 60,
    outcome: 'OK'
  }))
};

it('loads trace logs only after a trace query and highlights the selected log node', async () => {
  const dataSource: RuntimeDataSource = {
    listServices: jest.fn().mockResolvedValue(services),
    getTrace: jest.fn().mockResolvedValue(trace),
    listRecentTraces: jest.fn().mockResolvedValue([]),
    getServiceLogs: jest.fn(async ({ itemId, traceId }): Promise<ServiceLog[]> => [
      {
        id: 'current-log',
        itemId,
        traceId,
        level: 'INFO',
        timestamp: itemId === 'gateway' ? '2026-11-18T08:00:01Z' : '2026-11-18T08:00:02Z',
        message: itemId === 'gateway' ? 'request received' : 'order loaded'
      },
      {
        id: 'other-log',
        itemId,
        traceId: 'different-trace',
        level: 'ERROR',
        timestamp: '2026-11-18T08:00:03Z',
        message: 'unrelated request'
      }
    ])
  };

  render(<TopologyRunView baseDiagram={diagram} localeKey="zh-CN" dataSource={dataSource} onBackToEditor={jest.fn()} />);

  await screen.findByText('1 项异常');
  fireEvent.click(screen.getByRole('button', { name: '选择网关' }));
  const node = screen.getByRole('dialog', { name: 'Gateway' });
  expect(node.closest('.rtm-backdrop')?.getAttribute('data-canvas-interaction')).toBe('allow');
  expect(lockCanvasInteractions).not.toHaveBeenCalled();
  expect(within(node).getByText('CPU')).toBeTruthy();
  expect(within(node).getByText('24%')).toBeTruthy();
  expect(within(node).queryByText('调用日志')).toBeNull();
  expect(dataSource.getServiceLogs).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '选择业务服务' }));
  expect(screen.getByRole('dialog', { name: 'Business' })).toBe(node);
  expect(within(node).getByText('告警')).toBeTruthy();
  expect(within(node).getByText('80%')).toBeTruthy();
  expect(within(node).queryByText('24%')).toBeNull();
  expect(screen.getByTestId('focused-node').textContent).toBe('business');
  fireEvent.click(screen.getByRole('button', { name: '选择未监控节点' }));
  expect(screen.getByRole('dialog', { name: 'Unmonitored' })).toBe(node);
  expect(within(node).getByText('暂无节点指标')).toBeTruthy();
  expect(screen.getByTestId('focused-node').textContent).toBe('unmonitored');
  fireEvent.click(within(node).getByRole('button', { name: '关闭' }));

  fireEvent.click(screen.getByRole('button', { name: '主菜单' }));
  fireEvent.click(screen.getByRole('button', { name: '调用链路' }));
  const dialog = screen.getByRole('dialog', { name: '调用链路' });
  expect(lockCanvasInteractions).not.toHaveBeenCalled();
  expect(dataSource.getServiceLogs).not.toHaveBeenCalled();
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'TraceId' }), {
    target: { value: trace.traceId }
  });
  fireEvent.click(within(dialog).getByRole('button', { name: '查询' }));

  const waterfallTab = await within(dialog).findByRole('tab', { name: '调用瀑布图', selected: true });
  const logsTab = within(dialog).getByRole('tab', { name: '调用日志' });
  expect(within(dialog).queryByRole('document', { name: '日志内容' })).toBeNull();
  act(() => waterfallTab.focus());
  fireEvent.keyDown(waterfallTab, { key: 'ArrowRight' });
  expect(document.activeElement).toBe(logsTab);
  expect(logsTab.getAttribute('aria-selected')).toBe('true');
  expect(within(dialog).queryByRole('slider', { name: '回放进度' })).toBeNull();
  expect(within(dialog).getByRole('textbox', { name: 'TraceId' })).toBeTruthy();

  const logDocument = await within(dialog).findByRole('document', { name: '日志内容' });
  const gatewayLog = within(logDocument).getByText('request received').parentElement!;
  const businessLog = within(logDocument).getByText('order loaded').parentElement!;
  expect(within(dialog).queryByText('unrelated request')).toBeNull();
  expect(within(logDocument).queryAllByRole('button')).toHaveLength(0);
  expect(logDocument.textContent).toMatch(/request received\n[\s\S]*order loaded/);
  expect(dataSource.getServiceLogs).toHaveBeenCalledTimes(2);
  expect(dataSource.getServiceLogs).toHaveBeenCalledWith(expect.objectContaining({
    itemId: 'gateway',
    traceId: trace.traceId
  }));

  act(() => {
    logDocument.focus();
    window.getSelection()?.collapse(gatewayLog.firstChild, 0);
    document.dispatchEvent(new Event('selectionchange'));
  });
  expect(screen.getByTestId('focused-node').textContent).toBe('gateway');
  fireEvent.keyDown(logDocument, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(logDocument);
  expect(window.getSelection()?.focusNode).toBe(businessLog.firstChild);
  expect(businessLog.getAttribute('data-active')).toBe('true');
  expect(screen.getByTestId('focused-node').textContent).toBe('business');
  fireEvent.keyDown(logDocument, { key: 'a', ctrlKey: true });
  expect(window.getSelection()?.toString()).toMatch(/request received\n[\s\S]*order loaded/);
  expect(screen.getAllByRole('dialog')).toEqual([dialog]);

  fireEvent.click(screen.getByRole('button', { name: '主菜单' }));
  fireEvent.click(screen.getByRole('button', { name: '设置' }));
  const settings = screen.getByRole('dialog', { name: '运行视图设置' });
  const infoColor = within(settings).getByLabelText('INFO');
  fireEvent.change(infoColor, { target: { value: '#7434a0' } });
  expect(businessLog.style.color).toBe('rgb(116, 52, 160)');
  expect(loadRuntimeViewConfig().logColors.INFO).toBe('#7434a0');
  fireEvent.click(within(settings).getByRole('button', { name: '恢复默认颜色' }));
  expect(loadRuntimeViewConfig().logColors.INFO).not.toBe('#7434a0');
  fireEvent.click(within(settings).getByRole('button', { name: '关闭' }));
  expect(screen.getAllByRole('dialog')).toEqual([dialog]);

  fireEvent.click(waterfallTab);
  fireEvent.change(within(dialog).getByRole('slider', { name: '回放进度' }), {
    target: { value: '80' }
  });
  expect(screen.getByTestId('trace-links').textContent).toBe('gateway-business');
  expect(screen.getByTestId('trace-steps').textContent).toBe('gateway,business');
  fireEvent.click(within(dialog).getByTitle('播放回放'));
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭' }));
  expect(screen.getByTestId('trace-links').textContent).toBe('');
  expect(screen.getByTestId('trace-steps').textContent).toBe('');

  fireEvent.click(screen.getByRole('button', { name: '主菜单' }));
  fireEvent.click(screen.getByRole('button', { name: '调用链路' }));
  const reopened = screen.getByRole('dialog', { name: '调用链路' });
  expect(within(reopened).getByTitle('播放回放')).toBeTruthy();
  expect(screen.getByTestId('trace-links').textContent).toBe('gateway-business');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: '调用链路' })).toBeNull();
  expect(screen.getByTestId('trace-links').textContent).toBe('');
});

it('refreshes node status at the configured interval without overlapping requests', async () => {
  jest.useFakeTimers();
  try {
    let finishRefresh!: (states: ServiceState[]) => void;
    const pendingRefresh = new Promise<ServiceState[]>((resolve) => { finishRefresh = resolve; });
    const listServices = jest.fn()
      .mockResolvedValueOnce(services)
      .mockReturnValueOnce(pendingRefresh)
      .mockResolvedValue(services);
    const dataSource: RuntimeDataSource = {
      listServices,
      getTrace: jest.fn(),
      getServiceLogs: jest.fn(),
      listRecentTraces: jest.fn()
    };
    const tick = async (ms: number) => {
      await act(async () => { jest.advanceTimersByTime(ms); });
    };
    const { unmount } = render(
      <TopologyRunView baseDiagram={diagram} localeKey="zh-CN" dataSource={dataSource} onBackToEditor={jest.fn()} />
    );
    await tick(0);
    expect(listServices).toHaveBeenCalledTimes(1);
    await tick(9999);
    expect(listServices).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(listServices).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: '主菜单' }));
    fireEvent.click(screen.getByRole('button', { name: '设置' }));
    const settings = screen.getByRole('dialog', { name: '运行视图设置' });
    fireEvent.change(within(settings).getByRole('spinbutton', { name: '节点状态刷新间隔（秒）' }), {
      target: { value: '3' }
    });
    fireEvent.click(within(settings).getByRole('button', { name: '应用' }));
    expect(loadRuntimeViewConfig().nodeStatusRefreshSeconds).toBe(3);
    await tick(12000);
    expect(listServices).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishRefresh(services.map((service) => ({ ...service, status: 'CRITICAL' })));
    });
    expect(screen.getByText('2 项异常')).toBeTruthy();
    await tick(2999);
    expect(listServices).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(listServices).toHaveBeenCalledTimes(3);
    unmount();
    await tick(12000);
    expect(listServices).toHaveBeenCalledTimes(3);
  } finally {
    jest.useRealTimers();
  }
});
