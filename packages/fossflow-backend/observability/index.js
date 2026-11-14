import { createRepository } from './repository.js';
import { createCollectors } from './collectors/index.js';
import { createObservabilityService } from './service.js';
import { createObservabilityRouter } from './routes.js';

/**
 * 可观测性模块装配入口。
 * 只有 ENABLE_OBSERVABILITY=true 时才启用，避免影响纯绘图部署。
 */
export const createObservability = async ({ dataDir, env = process.env }) => {
  if (String(env.ENABLE_OBSERVABILITY).toLowerCase() !== 'true') {
    return null;
  }

  const repository = await createRepository({
    driver: env.OBS_DB_DRIVER || 'auto',
    dataDir
  });

  await repository.init();

  const collectors = createCollectors(env);
  const service = createObservabilityService({
    repository,
    collectors,
    env: env.OBS_ENV || 'prod'
  });

  // 可选：定时同步拓扑，避免每次都要手动 POST /sync
  const intervalSec = Number(env.OBS_SYNC_INTERVAL_SEC || 0);

  if (intervalSec > 0) {
    const timer = setInterval(() => {
      service.syncTopology().catch((error) => {
        console.error('[observability] scheduled sync failed:', error.message);
      });
    }, intervalSec * 1000);

    timer.unref?.();
  }

  return {
    repository,
    collectors,
    service,
    router: createObservabilityRouter({ service })
  };
};
