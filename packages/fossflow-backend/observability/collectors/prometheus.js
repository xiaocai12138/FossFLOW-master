/**
 * Prometheus 采集器。
 * 只产出系统指标（CPU/内存/QPS/错误率/P95/运行时长），
 * 全部按 tag_id 标签聚合，保证与图节点对齐。
 */

const DEFAULT_TEMPLATES = {
  cpu: ({ label, tag, rateWindow }) =>
    `100 * sum(rate(container_cpu_usage_seconds_total{${label}="${tag}"}[${rateWindow}]))`,

  memory: ({ label, tag }) =>
    `100 * sum(container_memory_working_set_bytes{${label}="${tag}"}) / 1024 / 1024`,

  qps: ({ label, tag, rateWindow }) =>
    `sum(rate(http_requests_total{${label}="${tag}"}[${rateWindow}]))`,

  errorRate: ({ label, tag, rateWindow }) =>
    `100 * sum(rate(http_requests_total{${label}="${tag}",status=~"5.."}[${rateWindow}])) / clamp_min(sum(rate(http_requests_total{${label}="${tag}"}[${rateWindow}])) , 1)`,

  latencyP95Ms: ({ label, tag, rateWindow }) =>
    `1000 * histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{${label}="${tag}"}[${rateWindow}])) by (le))`,

  uptimeSeconds: ({ label, tag }) =>
    `time() - process_start_time_seconds{${label}="${tag}"}`
};

const METRIC_UNITS = {
  cpu: '%',
  memory: 'MB',
  qps: 'count',
  errorRate: '%',
  latencyP95Ms: 'ms',
  uptimeSeconds: 's'
};

export const createPrometheusCollector = ({
  url,
  label = 'tag_id',
  rateWindow = '5m',
  timeoutMs = 4000,
  templates = {}
}) => {
  const base = String(url).replace(/\/+$/, '');
  const queries = { ...DEFAULT_TEMPLATES, ...templates };

  const instantQuery = async (promql) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        `${base}/api/v1/query?query=${encodeURIComponent(promql)}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`Prometheus HTTP ${response.status}`);
      }

      const payload = await response.json();

      if (payload.status !== 'success') {
        throw new Error(payload.error || 'Prometheus query failed');
      }

      const first = payload.data?.result?.[0];

      if (!first) return null;

      const raw = first.value?.[1] ?? first.values?.at(-1)?.[1];

      return raw === undefined ? null : Number(raw);
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    name: 'prometheus',
    emissions: ['METRIC'],

    async health() {
      try {
        const response = await fetch(`${base}/api/v1/status/buildinfo`);

        return response.ok
          ? { ok: true }
          : { ok: false, detail: `HTTP ${response.status}` };
      } catch (error) {
        return { ok: false, detail: error.message };
      }
    },

    /**
     * 取单个节点的一组指标。
     * 返回 [{ tagId, name, unit, value }]，为空的指标直接省略。
     */
    async collectMetrics({ tagId, names }) {
      const wanted = names?.length ? names : Object.keys(queries);
      const series = [];

      await Promise.all(
        wanted.map(async (name) => {
          const builder = queries[name];

          if (!builder) return;

          try {
            const value = await instantQuery(
              builder({ label, tag: tagId, rateWindow })
            );

            if (value === null || Number.isNaN(value)) return;

            series.push({
              tagId,
              name,
              unit: METRIC_UNITS[name] ?? '',
              value: Math.round(value * 100) / 100
            });
          } catch {
            // 单个指标失败不影响其它指标
          }
        })
      );

      return series;
    }
  };
};
