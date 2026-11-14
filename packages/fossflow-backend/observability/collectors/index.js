import { createSkyWalkingCollector } from './skywalking.js';
import { createPrometheusCollector } from './prometheus.js';
import { createMockCollector } from './mock.js';

/**
 * 采集器装配：配置决定启用哪些来源。
 * 新增数据源 = 在这里注册一个 Collector，其余层不需要改动。
 */
export const createCollectors = (env = process.env) => {
  // Mock 模式：优先于真实采集器，用于前端联调
  if (String(env.OBS_MOCK).toLowerCase() === 'true') {
    console.log('[observability] mock collector enabled (no external dependency)');

    return [createMockCollector({ env: env.OBS_ENV || 'prod' })];
  }

  const enabled = String(env.OBS_COLLECTORS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const collectors = [];

  for (const name of enabled) {
    if (name === 'skywalking' && env.OBS_SKYWALKING_URL) {
      collectors.push(
        createSkyWalkingCollector({
          url: env.OBS_SKYWALKING_URL,
          token: env.OBS_SKYWALKING_TOKEN || '',
          windowMinutes: Number(env.OBS_TOPOLOGY_WINDOW_MIN || 15),
          env: env.OBS_ENV || 'prod'
        })
      );
      continue;
    }

    if (name === 'prometheus' && env.OBS_PROM_URL) {
      collectors.push(
        createPrometheusCollector({
          url: env.OBS_PROM_URL,
          label: env.OBS_PROM_LABEL || 'tag_id',
          rateWindow: env.OBS_PROM_RATE_WINDOW || '5m',
          timeoutMs: Number(env.OBS_PROM_TIMEOUT_MS || 4000)
        })
      );
      continue;
    }

    console.warn(`[observability] collector "${name}" skipped (missing URL config)`);
  }

  return collectors;
};
