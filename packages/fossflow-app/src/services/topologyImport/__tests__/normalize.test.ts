import { normalizeCatalog } from '../normalize';

/** warnings 在类型上是可选的，断言时统一取成数组 */
const warningsOf = (catalog: ReturnType<typeof normalizeCatalog>): string[] =>
  catalog.warnings ?? [];

describe('normalizeCatalog', () => {
  it('接受合法契约并保留 source/fetchedAt', () => {
    const catalog = normalizeCatalog({
      data: {
        source: 'demo',
        fetchedAt: '2026-11-14T16:30:00Z',
        nodes: [
          {
            tagId: 'svc.gateway',
            kind: 'GATEWAY',
            name: 'gateway',
            health: 'HEALTHY',
            labels: { group: 'DEFAULT_GROUP' },
            instances: [{ id: '172.21.0.12:10001', health: 'HEALTHY', weight: 1 }]
          }
        ],
        edges: [],
        warnings: ['清单不全']
      }
    });

    expect(catalog.source).toBe('demo');
    expect(catalog.fetchedAt).toBe('2026-11-14T16:30:00Z');
    expect(catalog.nodes).toHaveLength(1);
    expect(catalog.nodes[0]).toEqual({
      tagId: 'svc.gateway',
      kind: 'GATEWAY',
      name: 'gateway',
      health: 'HEALTHY',
      labels: { group: 'DEFAULT_GROUP' },
      instances: [{ id: '172.21.0.12:10001', health: 'HEALTHY', weight: 1 }]
    });
    expect(warningsOf(catalog)).toContain('清单不全');
  });

  it('缺 tagId 或 name 的节点被丢弃并记 warning', () => {
    const catalog = normalizeCatalog({
      nodes: [
        { name: 'no-tag', kind: 'SERVICE', health: 'HEALTHY' },
        { tagId: 'svc.no-name', kind: 'SERVICE', health: 'HEALTHY' },
        { tagId: 'svc.ok', name: 'ok', kind: 'SERVICE', health: 'HEALTHY' }
      ],
      edges: []
    });

    expect(catalog.nodes.map((node) => node.tagId)).toEqual(['svc.ok']);
    expect(warningsOf(catalog)).toHaveLength(2);
  });

  it('非法 kind 回落 SERVICE，非法 health 回落 UNKNOWN', () => {
    const catalog = normalizeCatalog({
      nodes: [
        {
          tagId: 'svc.x',
          name: 'x',
          kind: 'SPACESHIP',
          health: 'ON_FIRE'
        }
      ],
      edges: []
    });

    expect(catalog.nodes[0].kind).toBe('SERVICE');
    expect(catalog.nodes[0].health).toBe('UNKNOWN');
  });

  it('边上引用不存在的节点会被丢弃并记 warning', () => {
    const catalog = normalizeCatalog({
      nodes: [
        { tagId: 'svc.a', name: 'a', kind: 'SERVICE', health: 'HEALTHY' }
      ],
      edges: [
        { from: 'svc.a', to: 'svc.ghost' },
        { from: 'svc.a', to: 'svc.a' }
      ]
    });

    expect(catalog.edges).toHaveLength(0);
    expect(warningsOf(catalog).some((w) => w.includes('svc.ghost'))).toBe(true);
    expect(warningsOf(catalog).some((w) => w.includes('自环'))).toBe(true);
  });

  it('保留合法边', () => {
    const catalog = normalizeCatalog({
      nodes: [
        { tagId: 'svc.a', name: 'a', kind: 'SERVICE', health: 'HEALTHY' },
        { tagId: 'svc.b', name: 'b', kind: 'SERVICE', health: 'HEALTHY' }
      ],
      edges: [{ from: 'svc.a', to: 'svc.b', kind: 'CALL' }]
    });

    expect(catalog.edges).toEqual([{ from: 'svc.a', to: 'svc.b', kind: 'CALL' }]);
  });

  it('完全无法识别时抛错，且错误消息只描述结构', () => {
    expect(() => normalizeCatalog(null)).toThrow(/响应结构不符/);
    expect(() => normalizeCatalog({ nodes: 'nope' })).toThrow(/nodes 必须是数组/);

    const message = (() => {
      try {
        normalizeCatalog({ nodes: 'nope' });
        return '';
      } catch (error) {
        return (error as Error).message;
      }
    })();

    // 只允许出现字段名，不允许出现任何来源/产品标识
    expect(message).toMatch(/^响应结构不符/);
  });

  it('重复 tagId 只保留第一个', () => {
    const catalog = normalizeCatalog({
      nodes: [
        { tagId: 'svc.a', name: 'first', kind: 'SERVICE', health: 'HEALTHY' },
        { tagId: 'svc.a', name: 'second', kind: 'SERVICE', health: 'HEALTHY' }
      ],
      edges: []
    });

    expect(catalog.nodes).toHaveLength(1);
    expect(catalog.nodes[0].name).toBe('first');
  });

  it('空清单不抛错，但会给出提示性 warning', () => {
    const catalog = normalizeCatalog({ nodes: [], edges: [] });

    expect(catalog.nodes).toHaveLength(0);
    expect(warningsOf(catalog)).toContain('清单中没有可用的节点');
  });
});
