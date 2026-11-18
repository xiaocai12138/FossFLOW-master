import { buildRuntimeOverlay } from '../../../services/runtime/overlayBuilder';
import type { TraceDetail } from '../../../services/runtime/types';

const TRACE: TraceDetail = {
  traceId: 'trace-sequence',
  startedAt: '2026-11-14T12:00:00.000Z',
  totalDurationMs: 30,
  entryService: 'msc-gateway',
  // 故意乱序：地图标号必须和瀑布图按 startMs 排序后的行号一致。
  spans: [
    {
      spanId: 'gateway-filter',
      itemId: 'svc.msc-gateway',
      serviceName: 'msc-gateway',
      operation: 'GatewayFilter',
      startMs: 20,
      durationMs: 1,
      outcome: 'OK'
    },
    {
      spanId: 'gateway-entry',
      itemId: 'svc.msc-gateway',
      serviceName: 'msc-gateway',
      operation: 'GET /business/calc/add',
      startMs: 0,
      durationMs: 30,
      outcome: 'OK'
    },
    {
      spanId: 'business-call',
      itemId: 'svc.msc-business-service',
      serviceName: 'msc-business-service',
      operation: 'GET /calc/add',
      startMs: 10,
      durationMs: 5,
      outcome: 'OK'
    }
  ]
};

describe('buildRuntimeOverlay', () => {
  it('按瀑布图的时间顺序把步骤号聚合到对应拓扑节点', () => {
    const overlay = buildRuntimeOverlay({
      trace: TRACE,
      services: [],
      view: { items: [], connectors: [] },
      revealRatio: 1
    });

    expect((overlay as any).traceStepNumbersByItemId).toEqual({
      'svc.msc-gateway': [1, 3],
      'svc.msc-business-service': [2]
    });
  });

  it('回放尚未开始时不提前在地图显示第一个步骤号', () => {
    const overlay = buildRuntimeOverlay({
      trace: TRACE,
      services: [],
      view: { items: [], connectors: [] },
      revealRatio: 0
    });

    expect((overlay as any).traceStepNumbersByItemId).toEqual({});
  });
});
