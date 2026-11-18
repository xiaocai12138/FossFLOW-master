/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDiagramSource } from '../../../hooks/useDiagramSource';
import type { DiagramData } from '../../../diagramUtils';

const mockLoad = jest.fn();

jest.mock('../../architectureStorage', () => ({
  architectureStorage: {
    load: (...args: unknown[]) => mockLoad(...args)
  }
}));

jest.mock('../../iconPackManagerV2', () => ({
  useIconPackManager: () => ({
    loadedIcons: [],
    isInitialLoadComplete: true,
    loadPacksForDiagram: jest.fn()
  })
}));

const serverDiagram = {
  title: 'server architecture',
  icons: [],
  colors: [],
  items: [
    { id: 'svc.msc-gateway', name: 'msc-gateway', icon: 'router', tag: 'svc.msc-gateway' }
  ],
  views: [
    {
      id: 'v-server',
      name: 'server view',
      items: [{ id: 'svc.msc-gateway', tile: { x: 2, y: 3 } }],
      connectors: [],
      rectangles: [],
      textBoxes: []
    }
  ],
  fitToView: true
} as unknown as DiagramData;

const localDiagram = {
  ...serverDiagram,
  title: 'stale local architecture',
  items: [{ id: 'stale-node', name: 'stale', icon: 'block' }],
  views: [
    {
      id: 'v-local',
      name: 'local view',
      items: [{ id: 'stale-node', tile: { x: 9, y: 9 } }],
      connectors: [],
      rectangles: [],
      textBoxes: []
    }
  ]
} as unknown as DiagramData;

const seedLocalCache = () => {
  localStorage.setItem('fossflow-last-opened-data', JSON.stringify(localDiagram));
};

describe('useDiagramSource（运行页数据来源）', () => {
  beforeEach(() => {
    mockLoad.mockReset();
    localStorage.clear();
  });

  it('带 architectureId 时读取服务器架构并渲染其节点', async () => {
    mockLoad.mockResolvedValue({
      id: 'arch-1',
      title: 'server architecture',
      diagram: serverDiagram
    });

    const { result } = renderHook(() => useDiagramSource(null, 'arch-1'));

    expect(result.current.architectureStatus).toBe('loading');

    await waitFor(() => {
      expect(result.current.architectureStatus).toBe('ready');
    });

    expect(mockLoad).toHaveBeenCalledWith('arch-1');
    expect(
      result.current.sanitizedDiagram.items.map((item: any) => item.id)
    ).toContain('svc.msc-gateway');
    expect(result.current.sanitizedDiagram.title).toBe('server architecture');
  });

  it('读取失败时进入 error 状态，且不回退本地缓存', async () => {
    seedLocalCache();
    mockLoad.mockRejectedValue(new Error('后台架构服务返回 500'));

    const { result } = renderHook(() => useDiagramSource(null, 'arch-1'));

    await waitFor(() => {
      expect(result.current.architectureStatus).toBe('error');
    });

    expect(result.current.architectureError).toContain('500');
    // 本地缓存里有 stale-node，但带 ID 时不得使用它
    expect(
      result.current.sanitizedDiagram.items.map((item: any) => item.id)
    ).not.toContain('stale-node');
  });

  it('未带 architectureId 时仍按本地缓存恢复（未保存的临时图）', () => {
    seedLocalCache();

    const { result } = renderHook(() => useDiagramSource(null, null));

    expect(result.current.architectureStatus).toBe('idle');
    expect(
      result.current.sanitizedDiagram.items.map((item: any) => item.id)
    ).toContain('stale-node');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('加载失败后可以重试，成功后回到 ready', async () => {
    mockLoad
      .mockRejectedValueOnce(new Error('临时网络错误'))
      .mockResolvedValueOnce({
        id: 'arch-1',
        title: 'server architecture',
        diagram: serverDiagram
      });

    const { result } = renderHook(() => useDiagramSource(null, 'arch-1'));

    await waitFor(() => {
      expect(result.current.architectureStatus).toBe('error');
    });

    act(() => {
      result.current.reloadArchitecture();
    });

    await waitFor(() => {
      expect(result.current.architectureStatus).toBe('ready');
    });

    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(
      result.current.sanitizedDiagram.items.map((item: any) => item.id)
    ).toContain('svc.msc-gateway');
  });
});
