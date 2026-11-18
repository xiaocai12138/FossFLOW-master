export const runtimeNodeStatusOptions = [
  'HEALTHY',
  'WARNING',
  'CRITICAL',
  'OFFLINE',
  'UNKNOWN'
] as const;

export type RuntimeNodeStatus = (typeof runtimeNodeStatusOptions)[number];

export interface RuntimeOverlay {
  nodeStates: Record<string, RuntimeNodeStatus>;
  connectorReveal: Record<string, number>;
  reachedItemIds: string[];
  dimmedItemIds: string[];
  /** 按调用时间排序后的步骤号，按目标节点聚合，用于与宿主的链路表格对应。 */
  traceStepNumbersByItemId?: Record<string, number[]>;
  focusedItemId?: string | null;
  /**
   * Whether the node name label should also show the health status. Driven by
   * the host application so a deployment can turn status display off entirely.
   */
  showHealth?: boolean;
  /** Localised labels for the health chip, keyed by status. */
  statusLabels?: Partial<Record<RuntimeNodeStatus, string>>;
}
