import { useEffect, useRef, useState } from 'react';
import type { RuntimeDataSource, ServiceState } from '../services/runtime/types';

export function useRuntimeServiceStatus(
  dataSource: RuntimeDataSource,
  items: Array<{ id: string; name?: string }>,
  refreshSeconds: number
): ServiceState[] {
  const [services, setServices] = useState<ServiceState[]>([]);
  const intervalMs = useRef(refreshSeconds * 1000);
  const reschedule = useRef<(() => void) | null>(null);

  useEffect(() => {
    intervalMs.current = refreshSeconds * 1000;
    reschedule.current?.();
  }, [refreshSeconds]);

  useEffect(() => {
    setServices([]);
    if (items.length === 0) return;

    let timer: number | undefined;
    let cancelled = false;
    let refreshing = false;

    function schedule() {
      window.clearTimeout(timer);
      if (!cancelled && !refreshing) {
        timer = window.setTimeout(refresh, intervalMs.current);
      }
    }

    async function refresh() {
      refreshing = true;
      try {
        const result = await dataSource.listServices(items);
        if (!cancelled) setServices(result);
      } catch {
        // 保留上次成功的节点状态，下个周期继续刷新。
      } finally {
        refreshing = false;
        schedule();
      }
    }

    reschedule.current = schedule;
    void refresh();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      reschedule.current = null;
    };
  }, [dataSource, items]);

  return services;
}
