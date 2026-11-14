import { RuntimeNodeStatus } from 'src/types';

export const RUNTIME_STATUS_COLORS: Record<
  RuntimeNodeStatus,
  { main: string; glow: string; label: string }
> = {
  HEALTHY: { main: '#22c55e', glow: 'rgba(34, 197, 94, 0.45)', label: 'Healthy' },
  WARNING: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)', label: 'Warning' },
  CRITICAL: { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.5)', label: 'Critical' },
  OFFLINE: { main: '#64748b', glow: 'rgba(100, 116, 139, 0.35)', label: 'Offline' },
  UNKNOWN: { main: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)', label: 'Unknown' }
};

export const TRACE_HIGHLIGHT_COLOR = '#0ea5e9';
export const TRACE_HIGHLIGHT_GLOW = 'rgba(14, 165, 233, 0.55)';

export const getRuntimeStatusColor = (status?: RuntimeNodeStatus | null) => {
  if (!status) return null;

  return RUNTIME_STATUS_COLORS[status] ?? RUNTIME_STATUS_COLORS.UNKNOWN;
};
