import { RuntimeNodeStatus, RuntimeOverlay } from 'fossflow/dist/types';
import { ServiceState, TraceDetail } from './types';

interface ConnectorLike {
  id: string;
  anchors?: Array<{ ref?: { item?: string } }>;
}

interface ViewLike {
  items?: Array<{ id: string }>;
  connectors?: ConnectorLike[];
}

interface BuildOverlayParams {
  trace: TraceDetail | null;
  services: ServiceState[];
  view: ViewLike | null;
  selectedItemId?: string | null;
  revealRatio: number;
  /** 系统配置：是否在节点名称旁展示健康状态 */
  showHealth?: boolean;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const connectorTouches = (connector: ConnectorLike) => {
  return (connector.anchors ?? [])
    .map((anchor) => anchor.ref?.item)
    .filter((value): value is string => Boolean(value));
};

const spanStatusToNodeStatus = (
  outcome: string,
  service?: ServiceState
): RuntimeNodeStatus => {
  if (outcome === 'ERROR') return 'CRITICAL';
  if (outcome === 'TIMEOUT') return 'WARNING';

  return service?.status ?? 'HEALTHY';
};

export const buildRuntimeOverlay = ({
  trace,
  services,
  view,
  selectedItemId,
  revealRatio,
  showHealth = true
}: BuildOverlayParams): RuntimeOverlay => {
  const nodeStates: Record<string, RuntimeNodeStatus> = {};

  services.forEach((service) => {
    nodeStates[service.itemId] = service.status;
  });

  const connectors = view?.connectors ?? [];
  const ratio = clamp01(revealRatio);

  if (!trace) {
    return {
      nodeStates,
      connectorReveal: {},
      reachedItemIds: [],
      dimmedItemIds: [],
      traceStepNumbersByItemId: {},
      focusedItemId: selectedItemId ?? null,
      showHealth
    };
  }

  const orderedSpans = trace.spans
    .slice()
    .sort((a, b) => a.startMs - b.startMs);
  const spanByItem = new Map(orderedSpans.map((span) => [span.itemId, span]));
  const orderedItems = orderedSpans.map((span) => span.itemId);

  const visibleCount =
    orderedItems.length === 0
      ? 0
      : Math.min(
          orderedItems.length,
          Math.max(0, Math.ceil(orderedItems.length * ratio))
        );
  const reachedItemIds = orderedItems.slice(0, visibleCount);
  const traceStepNumbersByItemId: Record<string, number[]> = {};

  orderedSpans.slice(0, visibleCount).forEach((span, index) => {
    const steps = traceStepNumbersByItemId[span.itemId] ?? [];

    steps.push(index + 1);
    traceStepNumbersByItemId[span.itemId] = steps;
  });

  reachedItemIds.forEach((itemId) => {
    const span = spanByItem.get(itemId);
    const service = services.find((entry) => entry.itemId === itemId);

    if (span) {
      nodeStates[itemId] = spanStatusToNodeStatus(span.outcome, service);
    }
  });

  const connectorReveal: Record<string, number> = {};

  connectors.forEach((connector) => {
    const touched = connectorTouches(connector);

    for (let index = 0; index < reachedItemIds.length - 1; index += 1) {
      const fromId = reachedItemIds[index];
      const toId = reachedItemIds[index + 1];

      if (touched.includes(fromId) && touched.includes(toId)) {
        const hopProgress = clamp01(ratio * (orderedItems.length - 1) - index);

        connectorReveal[connector.id] = Math.max(
          connectorReveal[connector.id] ?? 0,
          Math.max(hopProgress, index + 1 <= visibleCount - 1 ? 1 : 0)
        );
      }
    }
  });

  const dimmedItemIds = orderedItems.filter(
    (itemId) => !reachedItemIds.includes(itemId)
  );

  return {
    nodeStates,
    connectorReveal,
    reachedItemIds,
    dimmedItemIds,
    traceStepNumbersByItemId,
    focusedItemId: selectedItemId ?? null,
    showHealth
  };
};
