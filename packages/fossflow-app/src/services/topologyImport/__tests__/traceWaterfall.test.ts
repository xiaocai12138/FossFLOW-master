/** @jest-environment jsdom */

jest.mock('../../../components/TraceWaterfall/TraceWaterfall.css', () => ({}));

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TraceWaterfall } from '../../../components/TraceWaterfall/TraceWaterfall';
import type { TraceDetail } from '../../../services/runtime/types';

const TRACE: TraceDetail = {
  traceId: 'trace-layout',
  startedAt: '2026-11-14T12:00:00.000Z',
  totalDurationMs: 200,
  entryService: 'msc-gateway',
  spans: [
    {
      spanId: 'business',
      parentSpanId: 'gateway',
      itemId: 'svc.msc-business-service',
      serviceName: 'msc-business-service',
      operation: 'GET /orders',
      startMs: 80,
      durationMs: 60,
      outcome: 'OK'
    },
    {
      spanId: 'gateway',
      itemId: 'svc.msc-gateway',
      serviceName: 'msc-gateway',
      operation: 'GET /api/orders',
      startMs: 0,
      durationMs: 180,
      outcome: 'OK'
    }
  ]
};

describe('TraceWaterfall', () => {
  it('按开始时间为调用链标记连续步骤号', () => {
    render(React.createElement(TraceWaterfall, { trace: TRACE }));

    expect(screen.getByLabelText('调用顺序 1：msc-gateway').textContent).toBe('1');
    expect(screen.getByLabelText('调用顺序 2：msc-business-service').textContent).toBe('2');
  });
});
