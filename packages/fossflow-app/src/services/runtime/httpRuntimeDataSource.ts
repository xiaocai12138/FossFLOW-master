import {
  CallOutcome,
  RuntimeDataSource,
  ServiceLog,
  ServiceState,
  TraceDetail,
  TraceSpan
} from './types';
import { buildTagMapping } from './tagMapping';

/**
 * 走后端 /api/observability 的数据源。
 *
 * 后端当前返回 mock 数据，但接口契约已经固定；
 * 后续后端接上 SkyWalking / Prometheus 时，前端无需改动。
 *
 * 后端不可用时会退回本地 mock，保证页面不会白屏（并打印一次告警）。
 */

const API_BASE = '/api/observability';

interface ItemLike {
  id: string;
  name?: string;
}

interface BackendService {
  tagId: string;
  name: string;
  status: ServiceState['status'];
  version?: string;
  instance?: string;
  region?: string;
  lastHeartbeat?: string;
  metrics: ServiceState['metrics'];
}

interface BackendSpan {
  spanId: string;
  parentSpanId?: string;
  targetTagId: string;
  serviceName: string;
  operation: string;
  startMs: number;
  durationMs: number;
  outcome: CallOutcome;
}

interface BackendTrace {
  traceId: string;
  startedAt: string;
  totalDurationMs: number;
  entryService: string;
  spans: BackendSpan[];
}

interface BackendLog {
  id: string;
  tagId: string;
  traceId?: string;
  level: ServiceLog['level'];
  timestamp: string;
  message: string;
}

const statusCodeFor = (outcome: CallOutcome) => {
  if (outcome === 'ERROR') return 502;
  if (outcome === 'TIMEOUT') return 504;

  return 200;
};

export const createHttpRuntimeDataSource = ({
  items,
  baseUrl = API_BASE,
  fallback
}: {
  items: ItemLike[];
  baseUrl?: string;
  fallback: RuntimeDataSource;
}): RuntimeDataSource => {
  const { itemIdByTag, tagByItemId } = buildTagMapping(items);
  const allTagIds = Array.from(tagByItemId.values());
  const tagIdsQuery = allTagIds.length
    ? `tagIds=${allTagIds.map(encodeURIComponent).join(',')}`
    : '';

  let warned = false;

  const warnOnce = (error: unknown) => {
    if (warned) return;

    warned = true;
    console.warn(
      '[runtime] 后端接口不可用，已回退到本地 mock 数据：',
      error instanceof Error ? error.message : error
    );
  };

  const request = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${path}`);
    }

    const payload = await response.json();

    if (payload?.error) {
      throw new Error(payload.error.message ?? 'backend error');
    }

    return payload.data as T;
  };

  const toTraceDetail = (trace: BackendTrace): TraceDetail => {
    const spans: TraceSpan[] = (trace.spans ?? []).map((span) => ({
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      itemId: itemIdByTag.get(span.targetTagId) ?? span.targetTagId,
      serviceName: span.serviceName,
      operation: span.operation,
      startMs: span.startMs,
      durationMs: span.durationMs,
      outcome: span.outcome,
      statusCode: statusCodeFor(span.outcome)
    }));

    return {
      traceId: trace.traceId,
      startedAt: trace.startedAt,
      totalDurationMs: trace.totalDurationMs,
      entryService: trace.entryService,
      spans
    };
  };

  return {
    async listServices(diagramItems) {
      const tagIds = diagramItems
        .map((item) => tagByItemId.get(item.id))
        .filter((value): value is string => Boolean(value));

      if (tagIds.length === 0) return fallback.listServices(diagramItems);

      try {
        const data = await request<{ items: BackendService[] }>(
          `/services?tagIds=${tagIds.map(encodeURIComponent).join(',')}`
        );

        return (data.items ?? []).map((service) => ({
          itemId: itemIdByTag.get(service.tagId) ?? service.tagId,
          name: service.name,
          status: service.status,
          version: service.version,
          instance: service.instance,
          region: service.region,
          lastHeartbeat: service.lastHeartbeat,
          metrics: service.metrics
        }));
      } catch (error) {
        warnOnce(error);

        return fallback.listServices(diagramItems);
      }
    },

    async getTrace(traceId) {
      try {
        const query = tagIdsQuery ? `?${tagIdsQuery}` : '';
        const trace = await request<BackendTrace>(
          `/traces/${encodeURIComponent(traceId)}${query}`
        );

        return toTraceDetail(trace);
      } catch (error) {
        warnOnce(error);

        return fallback.getTrace(traceId);
      }
    },

    async listRecentTraces(limit = 10) {
      try {
        const query = [`limit=${limit}`, tagIdsQuery]
          .filter(Boolean)
          .join('&');
        const traces = await request<BackendTrace[]>(
          `/traces/recent?${query}`
        );

        return (traces ?? []).map(toTraceDetail);
      } catch (error) {
        warnOnce(error);

        return fallback.listRecentTraces(limit);
      }
    },

    async getServiceLogs({ itemId, traceId, limit = 40 }) {
      const tagId = tagByItemId.get(itemId) ?? itemId;

      try {
        const data = await request<{ items: BackendLog[] }>(
          `/nodes/${encodeURIComponent(tagId)}/logs?limit=${limit}${
            traceId ? `&traceId=${encodeURIComponent(traceId)}` : ''
          }`
        );

        return (data.items ?? []).map((log) => ({
          id: log.id,
          itemId,
          traceId: log.traceId,
          level: log.level,
          timestamp: log.timestamp,
          message: log.message
        }));
      } catch (error) {
        warnOnce(error);

        return fallback.getServiceLogs({ itemId, traceId, limit });
      }
    }
  };
};
