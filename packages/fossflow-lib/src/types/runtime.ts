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
  focusedItemId?: string | null;
  /**
   * Whether the node name label should also show the health status. Driven by
   * the host application so a deployment can turn status display off entirely.
   */
  showHealth?: boolean;
  /** Localised labels for the health chip, keyed by status. */
  statusLabels?: Partial<Record<RuntimeNodeStatus, string>>;
}
