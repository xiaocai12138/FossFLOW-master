import {
  CallOutcome,
  LogLevel,
  RuntimeDataSource,
  ServiceLog,
  ServiceState,
  ServiceStatus,
  TraceDetail,
  TraceSpan
} from './types';
import { resolveServiceName } from './nodeNaming';

export interface MockRuntimeOptions {
  items: Array<{ id: string; name?: string }>;
  now?: () => number;
}

const STATUS_POOL: ServiceStatus[] = [
  'HEALTHY',
  'HEALTHY',
  'HEALTHY',
  'HEALTHY',
  'HEALTHY',
  'WARNING',
  'CRITICAL',
  'OFFLINE'
];

const OUTCOMES: CallOutcome[] = ['OK', 'OK', 'OK', 'OK', 'OK', 'OK', 'ERROR', 'TIMEOUT'];

const METHODS = ['GET', 'POST', 'PUT', 'DELETE'];

const LOG_TEMPLATES: Record<LogLevel, string[]> = {
  DEBUG: [
    'cache lookup miss for key order:{id}',
    'connection pool stats active={n} idle={m}',
    'resolved upstream address via service discovery'
  ],
  INFO: [
    'handled {method} /api/v1/resource in {ms}ms',
    'span propagated downstream with parent context',
    'health probe succeeded, instance marked ready'
  ],
  WARN: [
    'queue depth approaching threshold: {n} pending messages',
    'retry attempt 1 of 3 after upstream timeout',
    'latency above baseline by {ms}ms'
  ],
  ERROR: [
    'downstream call failed with status 503, circuit breaker opened',
    'connection reset by peer while writing response',
    'deadline exceeded after {ms}ms, request aborted'
  ]
};

const hash = (value: string) => {
  let result = 0;

  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }

  return result;
};

const seeded = (seed: number, min: number, max: number) => {
  const ratio = (Math.abs(seed) % 1000) / 1000;

  return min + ratio * (max - min);
};

const round = (value: number, digits = 1) => {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
};

const pad = (value: number, size = 6) => value.toString().padStart(size, '0');

const slug = (name: string) => name.replace(/\s+/g, '-').toLowerCase();

export const createMockRuntimeDataSource = ({
  items,
  now = () => Date.now()
}: MockRuntimeOptions): RuntimeDataSource => {
  const services: ServiceState[] = items.map((item, index) => {
    const seed = hash(`${item.id}:${item.name ?? ''}`);
    const status = STATUS_POOL[seed % STATUS_POOL.length];
    const degraded = status === 'CRITICAL' || status === 'OFFLINE';

    return {
      itemId: item.id,
      // Placeholder names would leak "未命名" into every synthetic operation
      // path, so fall back to a stable machine name.
      name: resolveServiceName(item, index),
      status,
      version: `v${1 + (seed % 3)}.${seed % 10}.${(seed >>> 3) % 10}`,
      instance: `pod-${pad(seed % 4096, 4)}`,
      region: ['cn-hangzhou', 'cn-shanghai', 'cn-beijing'][seed % 3],
      lastHeartbeat: new Date(now() - (seed % 45) * 1000).toISOString(),
      metrics: {
        cpu: round(seeded(seed, 8, degraded ? 97 : 68)),
        memory: round(seeded(seed >>> 2, 22, degraded ? 95 : 78)),
        latencyP95Ms: round(seeded(seed >>> 4, 14, degraded ? 2400 : 300)),
        qps: Math.round(seeded(seed >>> 6, 15, 3400)),
        errorRate: round(
          degraded ? seeded(seed >>> 8, 3, 42) : seeded(seed >>> 8, 0, 1.2),
          2
        ),
        uptimeSeconds: Math.round(seeded(seed >>> 10, 3600, 2592000))
      }
    };
  });

  const serviceById = new Map(services.map((service) => [service.itemId, service]));

  const buildSpans = (
    traceId: string,
    picked: ServiceState[]
  ): TraceSpan[] => {
    const spans: TraceSpan[] = [];
    let cursor = 0;

    picked.forEach((service, index) => {
      const spanSeed = hash(`${traceId}:${service.itemId}:${index}`);
      const degraded = service.status === 'CRITICAL' || service.status === 'OFFLINE';
      const outcome = degraded
        ? OUTCOMES[spanSeed % 2 === 0 ? 6 : 7]
        : 'OK';
      const duration = Math.round(
        seeded(spanSeed, 6, service.status === 'CRITICAL' ? 1800 : 260)
      );

      spans.push({
        spanId: `${traceId.slice(-8)}-${pad(index + 1, 2)}`,
        parentSpanId: index === 0 ? undefined : spans[index - 1].spanId,
        itemId: service.itemId,
        serviceName: service.name,
        operation: `${METHODS[spanSeed % METHODS.length]} /api/${slug(
          service.name
        )}/handle`,
        startMs: cursor,
        durationMs: duration,
        outcome,
        statusCode: outcome === 'OK' ? 200 : outcome === 'TIMEOUT' ? 504 : 502
      });

      cursor += Math.max(1, Math.round(duration * 0.38));
    });

    return spans;
  };

  /**
   * Picks a contiguous window of services so the resulting spans form a
   * realistic call chain instead of an isolated single hop.
   */
  const pickChain = (seed: number, startIndex = 0) => {
    if (services.length === 0) return [];

    const desired = 3 + (Math.abs(seed) % 3);
    const count = Math.max(2, Math.min(services.length, desired));
    const from = Math.min(Math.max(0, startIndex), Math.max(0, services.length - count));

    return services.slice(from, from + count);
  };

  const buildTrace = (traceId: string, startIndex?: number): TraceDetail => {
    const seed = hash(traceId);
    const picked = pickChain(seed, startIndex ?? 0);
    const spans = buildSpans(traceId, picked);

    return {
      traceId,
      startedAt: new Date(now() - (seed % 900) * 1000).toISOString(),
      totalDurationMs: spans.length > 0
        ? spans[spans.length - 1].startMs + spans[spans.length - 1].durationMs
        : 0,
      entryService: picked[0]?.name ?? 'unknown',
      spans
    };
  };

  return {
    async listServices() {
      return services.map((service) => ({
        ...service,
        lastHeartbeat: new Date(now() - (hash(service.itemId) % 45) * 1000).toISOString()
      }));
    },

    async listRecentTraces(limit = 8) {
      return Array.from({ length: limit }).map((_, index) => {
        const traceId = `trace-${pad(hash(`recent:${index}`) % 100000000, 8)}`;

        return buildTrace(traceId);
      });
    },

    async getTrace(traceId) {
      const normalized = traceId.trim().toLowerCase();

      if (!normalized) return null;
      if (normalized.startsWith('missing') || normalized.includes('not-found')) {
        return null;
      }

      const matchedIndex = services.findIndex((service) => {
        return normalized.includes(slug(service.name)) || normalized.includes(
          service.itemId.toLowerCase()
        );
      });

      return buildTrace(traceId, matchedIndex >= 0 ? matchedIndex : undefined);
    },

    async getServiceLogs({ itemId, traceId, limit = 12 }) {
      const service = serviceById.get(itemId);

      if (!service) return [];

      const seed = hash(`${itemId}:${traceId ?? 'live'}`);
      const base = now() - (seed % 150) * 1000;
      const levels: LogLevel[] = ['DEBUG', 'INFO', 'INFO', 'INFO', 'WARN', 'ERROR'];
      const span = traceId
        ? buildTrace(traceId).spans.find((entry) => entry.itemId === itemId)
        : undefined;
      return Array.from({ length: limit }).map((_, index) => {
        const logSeed = hash(`${itemId}:${index}:${seed}`);
        const level = levels[logSeed % levels.length];
        const templates = LOG_TEMPLATES[level];
        const message = templates[logSeed % templates.length]
          .replace('{id}', pad(logSeed % 100000))
          .replace('{n}', String(logSeed % 90))
          .replace('{m}', String(logSeed % 40))
          .replace('{ms}', String(Math.round(seeded(logSeed, 4, 480))))
          .replace('{method}', METHODS[logSeed % METHODS.length]);

        return {
          id: `${itemId}-log-${index}`,
          itemId,
          traceId,
          level,
          timestamp: new Date(base + index * 437).toISOString(),
          message: span ? `[${span.operation}] ${message}` : message
        };
      });
    }
  };
};
