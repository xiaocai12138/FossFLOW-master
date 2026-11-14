export type ServiceStatus =
  | 'HEALTHY'
  | 'WARNING'
  | 'CRITICAL'
  | 'OFFLINE'
  | 'UNKNOWN';

export type CallOutcome = 'OK' | 'ERROR' | 'TIMEOUT';

export interface ServiceMetrics {
  cpu: number;
  memory: number;
  latencyP95Ms: number;
  qps: number;
  errorRate: number;
  uptimeSeconds: number;
}

export interface ServiceState {
  itemId: string;
  name: string;
  status: ServiceStatus;
  version?: string;
  instance?: string;
  region?: string;
  lastHeartbeat?: string;
  metrics: ServiceMetrics;
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface ServiceLog {
  id: string;
  itemId: string;
  traceId?: string;
  level: LogLevel;
  timestamp: string;
  message: string;
}

export interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  itemId: string;
  serviceName: string;
  operation: string;
  startMs: number;
  durationMs: number;
  outcome: CallOutcome;
  statusCode?: number;
}

export interface TraceDetail {
  traceId: string;
  startedAt: string;
  totalDurationMs: number;
  entryService: string;
  spans: TraceSpan[];
}

export interface RuntimeDataSource {
  listServices(diagramItems: Array<{ id: string; name?: string }>): Promise<ServiceState[]>;
  getTrace(traceId: string): Promise<TraceDetail | null>;
  getServiceLogs(params: {
    itemId: string;
    traceId?: string;
    limit?: number;
  }): Promise<ServiceLog[]>;
  listRecentTraces(limit?: number): Promise<TraceDetail[]>;
}
