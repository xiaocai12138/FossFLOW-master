import express from 'express';

const fail = (res, status, code, message) => {
  return res.status(status).json({ error: { code, message } });
};

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('[observability] request failed:', error);

    if (!res.headersSent) {
      fail(res, 502, 'UPSTREAM_ERROR', error.message);
    }
  }
};

/**
 * 对外只暴露 Canonical Model，不出现任何上游专有字段。
 */
export const createObservabilityRouter = ({ service }) => {
  const router = express.Router();

  router.get(
    '/health',
    wrap(async (req, res) => {
      res.json({ data: await service.health() });
    })
  );

  /** 图快照：节点 + 连边，供架构图初始化与增量刷新 */
  router.get(
    '/graph',
    wrap(async (req, res) => {
      const graph = await service.getGraph({ env: req.query.env });
      const etag = `"g${graph.version}"`;

      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.set('ETag', etag).json({ data: graph });
    })
  );

  /** 服务目录（原始元数据，便于管理界面使用） */
  router.get(
    '/tags',
    wrap(async (req, res) => {
      res.json({ data: await service.listTags({ env: req.query.env }) });
    })
  );

  /** 手动登记一个服务，tag_id 由后端按 svc.<name> 生成 */
  router.post(
    '/tags',
    wrap(async (req, res) => {
      const { name, kind = 'SERVICE', env, labels, parentTagId } = req.body ?? {};

      if (!name) return fail(res, 400, 'INVALID_ARGUMENT', 'name is required');

      const node = await service.registerTag({
        name,
        kind,
        env,
        labels,
        parentTagId
      });

      res.status(201).json({ data: node });
    })
  );

  /** 绑定外部标识（SkyWalking serviceCode / Prometheus label / 自研 ID） */
  router.post(
    '/bindings',
    wrap(async (req, res) => {
      const { source, externalId, tagId } = req.body ?? {};

      if (!source || !externalId || !tagId) {
        return fail(res, 400, 'INVALID_ARGUMENT', 'source/externalId/tagId required');
      }

      await service.bind({ source, externalId, tagId });
      res.status(201).json({ data: { source, externalId, tagId } });
    })
  );

  /** 上报图边（自研采集器 / 手工补录） */
  router.post(
    '/edges',
    wrap(async (req, res) => {
      const { fromTag, toTag, kind, env, callsPerMin, errorRate, p95Ms } =
        req.body ?? {};

      if (!fromTag || !toTag) {
        return fail(res, 400, 'INVALID_ARGUMENT', 'fromTag/toTag required');
      }

      const edge = await service.upsertEdge({
        fromTag,
        toTag,
        kind,
        env,
        callsPerMin,
        errorRate,
        p95Ms
      });

      res.status(201).json({ data: edge });
    })
  );

  /** 节点详情：元数据 + 上下游 + 实例 */
  router.get(
    '/nodes/:tagId',
    wrap(async (req, res) => {
      const node = await service.getNode(req.params.tagId);

      if (!node) return fail(res, 404, 'NOT_FOUND', 'tag not found');

      res.json({ data: node });
    })
  );

  /**
   * 批量取服务状态（前端运行视图主数据源）。
   * tagIds 由前端按图中节点传入，后端按 tag_id 返回状态与指标。
   */
  router.get(
    '/services',
    wrap(async (req, res) => {
      const tagIds = req.query.tagIds
        ? String(req.query.tagIds)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

      res.json({
        data: await service.getServices({ tagIds, env: req.query.env })
      });
    })
  );

  /** 节点指标（CPU/内存/QPS/P95…），并行查询所有 METRIC 采集器 */
  router.get(
    '/nodes/:tagId/metrics',
    wrap(async (req, res) => {
      const names = req.query.names ? String(req.query.names).split(',') : undefined;
      const result = await service.getMetrics({ tagId: req.params.tagId, names });

      res.json({ data: result });
    })
  );

  /** 节点日志（由 ES/Loki 提供，关系库不存） */
  router.get(
    '/nodes/:tagId/logs',
    wrap(async (req, res) => {
      const result = await service.getLogs({
        tagId: req.params.tagId,
        traceId: req.query.traceId,
        from: req.query.from,
        to: req.query.to,
        level: req.query.level,
        limit: Number(req.query.limit || 100)
      });

      res.json({ data: result });
    })
  );

  /**
   * 最近的调用链路（必须在 /traces/:traceId 之前注册，避免被通配吞掉）。
   * tagIds 用于让 mock 沿真实图节点生成链路。
   */
  router.get(
    '/traces/recent',
    wrap(async (req, res) => {
      const limit = Number(req.query.limit || 10);
      const tagIds = req.query.tagIds
        ? String(req.query.tagIds)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;

      res.json({ data: await service.getRecentTraces({ limit, tagIds }) });
    })
  );

  /** Trace 详情，path 可直接用于架构图高亮 */
  router.get(
    '/traces/:traceId',
    wrap(async (req, res) => {
      const tagIds = req.query.tagIds
        ? String(req.query.tagIds)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : undefined;
      const trace = await service.getTrace(req.params.traceId, { tagIds });

      if (!trace) return fail(res, 404, 'NOT_FOUND', 'trace not found');

      res.json({ data: trace });
    })
  );

  /** 手动触发拓扑同步（也可由定时任务调用） */
  router.post(
    '/sync',
    wrap(async (req, res) => {
      res.json({ data: await service.syncTopology() });
    })
  );

  return router;
};
