import {
  HEALTH,
  instanceTagId,
  normalizeName,
  serviceTagId,
  toGraph,
  worseHealth
} from './model.js';

/**
 * 编排层：把仓储（元数据）与采集器（遥测）组合成对外的 Canonical 视图。
 * 日志与指标不落关系库，这里只做查询编排与降级。
 */

const GRAPH_VERSION_KEY = 'graph.version';

const metricMap = (series = []) => {
  return series.reduce((acc, item) => {
    acc[item.name] = item.value;

    return acc;
  }, {});
};

export const createObservabilityService = ({
  repository,
  collectors,
  env = 'prod'
}) => {
  // 健康判定阈值，集中一处，便于按环境调整
  const thresholds = {
    errorRateWarning: Number(process.env.OBS_ERR_WARN ?? 5),
    errorRateCritical: Number(process.env.OBS_ERR_CRIT ?? 20),
    p95WarningMs: Number(process.env.OBS_P95_WARN_MS ?? 800),
    p95CriticalMs: Number(process.env.OBS_P95_CRIT_MS ?? 2000)
  };

  const byCapability = (capability) => {
    return collectors.filter((collector) =>
      collector.emissions.includes(capability)
    );
  };

  const bumpVersion = async () => {
    const current = Number((await repository.getMeta(GRAPH_VERSION_KEY)) || 0);
    const next = current + 1;

    await repository.setMeta(GRAPH_VERSION_KEY, String(next));

    return next;
  };

  const getVersion = async () => {
    return Number((await repository.getMeta(GRAPH_VERSION_KEY)) || 0);
  };

  /**
   * 拓扑同步：抓取服务（+ 实例）与调用边，写入元数据库。
   * 已存在的节点保留其 health，避免把真实状态覆盖成默认值。
   */
  const syncTopology = async () => {
    const summary = { nodes: 0, edges: 0, collectors: [] };

    for (const collector of byCapability('GRAPH')) {
      try {
        const graph = (await collector.collectGraph?.()) ?? { nodes: [], edges: [] };
        const instances = (await collector.collectInstances?.()) ?? { nodes: [] };

        for (const node of [...graph.nodes, ...instances.nodes]) {
          const existing = await repository.getNode(node.tagId);

          await repository.upsertNode({
            ...node,
            health: existing
              ? worseHealth(existing.health, node.health)
              : node.health
          });
          summary.nodes += 1;
        }

        for (const edge of graph.edges ?? []) {
          await repository.upsertEdge(edge);
          summary.edges += 1;
        }

        summary.collectors.push({ name: collector.name, ok: true });
      } catch (error) {
        console.error(`[observability] sync failed for ${collector.name}:`, error.message);
        summary.collectors.push({
          name: collector.name,
          ok: false,
          detail: error.message
        });
      }
    }

    if (summary.nodes > 0 || summary.edges > 0) {
      await bumpVersion();
    }

    return summary;
  };

  const getGraph = async ({ env: targetEnv = env } = {}) => {
    const [nodes, edges, version] = await Promise.all([
      repository.listNodes({ env: targetEnv }),
      repository.listEdges({ env: targetEnv }),
      getVersion()
    ]);

    return toGraph({ nodes, edges, version, env: targetEnv });
  };

  const listTags = async ({ env: targetEnv = env } = {}) => {
    return repository.listNodes({ env: targetEnv });
  };

  const getNode = async (tagId) => {
    const node = await repository.getNode(tagId);

    if (!node) return null;

    const [bindings, instances, edges] = await Promise.all([
      repository.listBindings(tagId),
      repository.listNodes({ env: node.env }),
      repository.listEdges({ env: node.env })
    ]);

    const children = instances.filter((item) => item.parentTagId === tagId);

    return {
      ...node,
      bindings,
      instances: children,
      upstream: edges.filter((edge) => edge.toTag === tagId),
      downstream: edges.filter((edge) => edge.fromTag === tagId)
    };
  };

  /** 指标：并行查询所有支持 METRIC 的采集器 */
  const getMetrics = async ({ tagId, names }) => {
    const series = [];

    await Promise.all(
      byCapability('METRIC').map(async (collector) => {
        try {
          const result = (await collector.collectMetrics?.({ tagId, names })) ?? [];
          series.push(...result);
        } catch (error) {
          console.warn(`[observability] metrics failed for ${collector.name}:`, error.message);
        }
      })
    );

    return { tagId, series, values: metricMap(series) };
  };

  const getTrace = async (traceId, { tagIds } = {}) => {
    for (const collector of byCapability('TRACE')) {
      try {
        const trace = await collector.collectTrace?.(traceId, { tagIds });

        if (trace) return trace;
      } catch (error) {
        console.warn(`[observability] trace failed for ${collector.name}:`, error.message);
      }
    }

    return null;
  };

  /** 日志：由专用存储（ES / Loki）提供，关系库不存 */
  const getLogs = async ({ tagId, traceId, from, to, level, limit = 100 }) => {
    const warnings = [];

    for (const collector of byCapability('LOG')) {
      try {
        const items = await collector.collectLogs?.({
          tagId,
          traceId,
          from,
          to,
          level,
          limit
        });

        if (items) return { tagId, items, warnings };
      } catch (error) {
        warnings.push(`${collector.name}: ${error.message}`);
      }
    }

    if (warnings.length === 0) {
      warnings.push('log collector not configured; set OBS_LOG_PROVIDER');
    }

    return { tagId, items: [], warnings };
  };

  /**
   * 由指标推导健康状态。
   * 阈值可通过环境变量覆盖，规则集中在这里，避免散落到前端。
   */
  const deriveStatus = (metrics, fallback = HEALTH.UNKNOWN) => {
    const errorRate = Number(metrics.errorRate ?? 0);
    const p95 = Number(metrics.latencyP95Ms ?? 0);

    if (errorRate >= thresholds.errorRateCritical) return HEALTH.CRITICAL;
    if (p95 >= thresholds.p95CriticalMs) return HEALTH.CRITICAL;
    if (errorRate >= thresholds.errorRateWarning) return HEALTH.WARNING;
    if (p95 >= thresholds.p95WarningMs) return HEALTH.WARNING;

    return fallback === HEALTH.OFFLINE ? HEALTH.OFFLINE : HEALTH.HEALTHY;
  };

  /**
   * 批量取服务状态：元数据来自关系库，指标来自 METRIC 采集器。
   * 这是前端运行视图的主要数据来源。
   */
  const getServices = async ({ tagIds = [], env: targetEnv = env }) => {
    const results = await Promise.all(
      tagIds.map(async (tagId) => {
        const [node, metricResult] = await Promise.all([
          repository.getNode(tagId),
          getMetrics({ tagId })
        ]);

        const values = metricResult.values ?? {};
        const metrics = {
          cpu: values.cpu ?? 0,
          memory: values.memory ?? 0,
          latencyP95Ms: values.latencyP95Ms ?? 0,
          qps: values.qps ?? 0,
          errorRate: values.errorRate ?? 0,
          uptimeSeconds: values.uptimeSeconds ?? 0
        };

        return {
          tagId,
          name: node?.name ?? tagId.replace(/^svc\./, ''),
          kind: node?.kind ?? 'SERVICE',
          status: deriveStatus(metrics, node?.health ?? HEALTH.UNKNOWN),
          version: node?.labels?.version,
          instance: node?.labels?.instance,
          region: node?.labels?.region,
          lastHeartbeat: node?.lastSeen ?? new Date().toISOString(),
          metrics
        };
      })
    );

    return { env: targetEnv, items: results };
  };

  /** 最近的调用链路，供前端初始化链路列表 */
  const getRecentTraces = async ({ limit = 10, tagIds } = {}) => {
    for (const collector of byCapability('TRACE')) {
      if (typeof collector.collectRecentTraces !== 'function') continue;

      try {
        const traces = await collector.collectRecentTraces({ limit, tagIds });

        if (traces?.length) return traces;
      } catch (error) {
        console.warn(`[observability] recent traces failed:`, error.message);
      }
    }

    return [];
  };

  const health = async () => {
    const entries = await Promise.all(
      collectors.map(async (collector) => {
        try {
          return { name: collector.name, ...(await collector.health()) };
        } catch (error) {
          return { name: collector.name, ok: false, detail: error.message };
        }
      })
    );

    return {
      ok: entries.length > 0 && entries.every((entry) => entry.ok),
      driver: repository.driver,
      graphVersion: await getVersion(),
      collectors: entries
    };
  };

  /**
   * 手动登记一个图节点。tag_id 由后端统一生成，不接受外部传入，
   * 以保证 “svc.<name>” 规则唯一且稳定。
   */
  const registerTag = async ({
    name,
    kind = 'SERVICE',
    env: targetEnv = env,
    labels = {},
    parentTagId = null
  }) => {
    const tagId =
      kind === 'INSTANCE'
        ? parentTagId
          ? `${parentTagId.replace(/^svc\./, 'inst.')}.${normalizeName(name)}`
          : instanceTagId(name, name)
        : serviceTagId(name);

    const existing = await repository.getNode(tagId);

    const node = {
      tagId,
      kind,
      name,
      env: targetEnv,
      parentTagId,
      labels,
      health: existing?.health ?? HEALTH.UNKNOWN,
      lastSeen: new Date().toISOString()
    };

    await repository.upsertNode(node);
    await bumpVersion();

    return node;
  };

  /** 绑定外部标识到 tag_id，是接入新采集器的唯一入口 */
  const bind = async ({ source, externalId, tagId }) => {
    await repository.bind({ source, externalId, tagId });
  };

  /** 上报一条图边，供自研采集器或手工补录使用 */
  const upsertEdge = async ({ fromTag, toTag, kind = 'CALL', env: targetEnv = env, ...stats }) => {
    const edge = {
      fromTag,
      toTag,
      kind,
      env: targetEnv,
      callsPerMin: stats.callsPerMin ?? null,
      errorRate: stats.errorRate ?? null,
      p95Ms: stats.p95Ms ?? null
    };

    await repository.upsertEdge(edge);
    await bumpVersion();

    return edge;
  };

  return {
    syncTopology,
    getGraph,
    listTags,
    getNode,
    getMetrics,
    getServices,
    getRecentTraces,
    getTrace,
    getLogs,
    health,
    registerTag,
    bind,
    upsertEdge,
    updateHealth: async (tagId, status) => {
      const node = await repository.getNode(tagId);

      if (!node) return null;

      const next = {
        ...node,
        health: status ?? HEALTH.UNKNOWN,
        lastSeen: new Date().toISOString()
      };

      await repository.upsertNode(next);

      return next;
    }
  };
};
