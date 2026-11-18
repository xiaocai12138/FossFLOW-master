import { layoutNodes } from '../layout';
import type { RegistryEdge, RegistryNode } from '../types';

const node = (tagId: string): RegistryNode => ({
  tagId,
  kind: 'SERVICE',
  name: tagId,
  health: 'HEALTHY'
});

describe('layoutNodes', () => {
  it('无 edges 时按 3 列网格铺开', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e'].map(node);
    const positions = layoutNodes(nodes, []);

    expect(positions.get('a')).toEqual({ x: 0, y: 6 });
    expect(positions.get('b')).toEqual({ x: 6, y: 6 });
    expect(positions.get('c')).toEqual({ x: 12, y: 6 });
    expect(positions.get('d')).toEqual({ x: 0, y: 12 });
    expect(positions.get('e')).toEqual({ x: 6, y: 12 });
  });

  it('默认布局为图标和名称卡片预留足够的横纵间距', () => {
    const positions = layoutNodes(['a', 'b', 'c', 'd'].map(node), []);

    expect(positions.get('b')!.x - positions.get('a')!.x).toBeGreaterThanOrEqual(6);
    expect(positions.get('d')!.y - positions.get('a')!.y).toBeGreaterThanOrEqual(6);
  });

  it('无 edges 时尊重 columnStep / rowStep / startY', () => {
    const positions = layoutNodes(['a', 'b', 'c', 'd'].map(node), [], {
      columnStep: 8,
      rowStep: 2,
      startY: 1
    });

    expect(positions.get('a')).toEqual({ x: 0, y: 1 });
    expect(positions.get('c')).toEqual({ x: 16, y: 1 });
    expect(positions.get('d')).toEqual({ x: 0, y: 3 });
  });

  it('有 edges 时按最长路径分层', () => {
    const nodes = ['a', 'b', 'c', 'd'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' }
    ];

    const positions = layoutNodes(nodes, edges);

    // a 深度 0，b/c 深度 1，d 取 max(2,2) = 2
    expect(positions.get('a')!.x).toBe(0);
    expect(positions.get('b')!.x).toBe(6);
    expect(positions.get('c')!.x).toBe(6);
    expect(positions.get('d')!.x).toBe(12);
    // 同层纵向分开
    expect(positions.get('b')!.y).not.toBe(positions.get('c')!.y);
  });

  it('取最长路径：短路径不会把深层节点提前', () => {
    const nodes = ['a', 'b', 'c'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'a', to: 'c' },
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' }
    ];

    const positions = layoutNodes(nodes, edges);

    expect(positions.get('c')!.x).toBe(12);
  });

  it('成环不会死循环，环上节点落到最深层之后', () => {
    const nodes = ['a', 'b', 'c', 'entry'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'entry', to: 'a' },
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' }
    ];

    const positions = layoutNodes(nodes, edges);

    expect(positions.size).toBe(4);
    positions.forEach((position) => {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.y)).toBe(true);
    });

    // entry=0, a=1, b=2, c=3 本来都有解；真实环 (a->b->c->a) 里 a 入度非 0，
    // 所以 a/b/c 中只有 entry 的下游能确定，其余统一被推到最深层
    expect(positions.get('entry')!.x).toBe(0);
    expect(positions.get('a')!.x).toBeGreaterThan(0);
  });

  it('纯环（所有节点入度都非 0）不死循环且全部拿到位置', () => {
    const nodes = ['a', 'b'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' }
    ];

    const positions = layoutNodes(nodes, edges);

    expect(positions.size).toBe(2);
    expect(positions.get('a')).toBeDefined();
    expect(positions.get('b')).toBeDefined();
    expect(positions.get('a')!.x).toBe(positions.get('b')!.x);
  });

  it('忽略自环与引用缺失节点的边', () => {
    const nodes = ['a', 'b'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'a', to: 'a' },
      { from: 'a', to: 'ghost' }
    ];

    // 可用边为 0，退化成网格
    const positions = layoutNodes(nodes, edges);

    expect(positions.get('a')).toEqual({ x: 0, y: 6 });
    expect(positions.get('b')).toEqual({ x: 6, y: 6 });
  });

  it('重复边不会让节点漏掉分层', () => {
    const nodes = ['a', 'b'].map(node);
    const edges: RegistryEdge[] = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'b' }
    ];

    const positions = layoutNodes(nodes, edges);

    expect(positions.get('b')!.x).toBe(6);
  });

  it('空输入返回空 Map', () => {
    expect(layoutNodes([], []).size).toBe(0);
  });
});
