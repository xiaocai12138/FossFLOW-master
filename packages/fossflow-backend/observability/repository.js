import path from 'path';

/**
 * 元数据仓储：只存“服务目录 + 绑定关系 + 图边”，不存日志与指标。
 * 提供 memory / sqlite 两种驱动，接口完全一致，便于后续替换为 Postgres。
 */

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS obs_tag (
  tag_id        TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL,
  env           TEXT NOT NULL DEFAULT 'prod',
  parent_tag_id TEXT,
  labels        TEXT NOT NULL DEFAULT '{}',
  health        TEXT NOT NULL DEFAULT 'UNKNOWN',
  last_seen     TEXT
);

CREATE TABLE IF NOT EXISTS obs_tag_binding (
  source      TEXT NOT NULL,
  external_id TEXT NOT NULL,
  tag_id      TEXT NOT NULL,
  PRIMARY KEY (source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_binding_tag ON obs_tag_binding (tag_id);

CREATE TABLE IF NOT EXISTS obs_edge (
  from_tag      TEXT NOT NULL,
  to_tag        TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'CALL',
  env           TEXT NOT NULL DEFAULT 'prod',
  calls_per_min REAL,
  error_rate    REAL,
  p95_ms        REAL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (from_tag, to_tag, kind, env)
);

CREATE TABLE IF NOT EXISTS obs_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const bindingKey = (source, externalId) => `${source}\u0000${externalId}`;
const edgeKey = (edge) => `${edge.fromTag}|${edge.toTag}|${edge.kind}|${edge.env}`;

/** ---------------------------- memory ---------------------------- */
export const createMemoryRepository = () => {
  const tags = new Map();
  const bindings = new Map();
  const edges = new Map();
  const meta = new Map();

  return {
    driver: 'memory',
    async init() {},

    async upsertNode(node) {
      tags.set(node.tagId, { ...node });
    },

    async getNode(tagId) {
      return tags.get(tagId) ?? null;
    },

    async listNodes({ env } = {}) {
      const all = [...tags.values()];

      return env ? all.filter((node) => node.env === env) : all;
    },

    async upsertEdge(edge) {
      const key = edgeKey(edge);

      edges.set(key, { ...edge, updatedAt: new Date().toISOString() });
    },

    async listEdges({ env } = {}) {
      const all = [...edges.values()];

      return env ? all.filter((edge) => edge.env === env) : all;
    },

    async bind({ source, externalId, tagId }) {
      bindings.set(bindingKey(source, externalId), { source, externalId, tagId });
    },

    async resolveTagId(source, externalId) {
      return bindings.get(bindingKey(source, externalId))?.tagId ?? null;
    },

    async listBindings(tagId) {
      return [...bindings.values()].filter((item) => item.tagId === tagId);
    },

    async getMeta(key) {
      return meta.get(key) ?? null;
    },

    async setMeta(key, value) {
      meta.set(key, value);
    },

    async close() {}
  };
};

/** ---------------------------- sqlite ---------------------------- */
export const createSqliteRepository = async ({ file }) => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file);

  db.exec(SCHEMA_SQL);

  const jsonSafe = (value) => {
    try {
      return JSON.parse(value || '{}');
    } catch {
      return {};
    }
  };

  return {
    driver: 'sqlite',
    async init() {},

    async upsertNode(node) {
      db.prepare(
        `INSERT INTO obs_tag (tag_id, kind, name, env, parent_tag_id, labels, health, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tag_id) DO UPDATE SET
           kind = excluded.kind,
           name = excluded.name,
           env = excluded.env,
           parent_tag_id = COALESCE(excluded.parent_tag_id, obs_tag.parent_tag_id),
           labels = excluded.labels,
           health = excluded.health,
           last_seen = COALESCE(excluded.last_seen, obs_tag.last_seen)`
      ).run(
        node.tagId,
        node.kind,
        node.name,
        node.env,
        node.parentTagId ?? null,
        JSON.stringify(node.labels ?? {}),
        node.health,
        node.lastSeen ?? null
      );
    },

    async getNode(tagId) {
      const row = db.prepare('SELECT * FROM obs_tag WHERE tag_id = ?').get(tagId);

      if (!row) return null;

      return {
        tagId: row.tag_id,
        kind: row.kind,
        name: row.name,
        env: row.env,
        parentTagId: row.parent_tag_id,
        labels: jsonSafe(row.labels),
        health: row.health,
        lastSeen: row.last_seen
      };
    },

    async listNodes({ env } = {}) {
      const rows = env
        ? db.prepare('SELECT * FROM obs_tag WHERE env = ?').all(env)
        : db.prepare('SELECT * FROM obs_tag').all();

      return rows.map((row) => ({
        tagId: row.tag_id,
        kind: row.kind,
        name: row.name,
        env: row.env,
        parentTagId: row.parent_tag_id,
        labels: jsonSafe(row.labels),
        health: row.health,
        lastSeen: row.last_seen
      }));
    },

    async upsertEdge(edge) {
      db.prepare(
        `INSERT INTO obs_edge (from_tag, to_tag, kind, env, calls_per_min, error_rate, p95_ms, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(from_tag, to_tag, kind, env) DO UPDATE SET
           calls_per_min = COALESCE(excluded.calls_per_min, obs_edge.calls_per_min),
           error_rate = COALESCE(excluded.error_rate, obs_edge.error_rate),
           p95_ms = COALESCE(excluded.p95_ms, obs_edge.p95_ms),
           updated_at = excluded.updated_at`
      ).run(
        edge.fromTag,
        edge.toTag,
        edge.kind,
        edge.env,
        edge.callsPerMin ?? null,
        edge.errorRate ?? null,
        edge.p95Ms ?? null,
        new Date().toISOString()
      );
    },

    async listEdges({ env } = {}) {
      const rows = env
        ? db.prepare('SELECT * FROM obs_edge WHERE env = ?').all(env)
        : db.prepare('SELECT * FROM obs_edge').all();

      return rows.map((row) => ({
        fromTag: row.from_tag,
        toTag: row.to_tag,
        kind: row.kind,
        env: row.env,
        callsPerMin: row.calls_per_min,
        errorRate: row.error_rate,
        p95Ms: row.p95_ms,
        updatedAt: row.updated_at
      }));
    },

    async bind({ source, externalId, tagId }) {
      db.prepare(
        `INSERT INTO obs_tag_binding (source, external_id, tag_id)
         VALUES (?, ?, ?)
         ON CONFLICT(source, external_id) DO UPDATE SET tag_id = excluded.tag_id`
      ).run(source, externalId, tagId);
    },

    async resolveTagId(source, externalId) {
      const row = db
        .prepare('SELECT tag_id FROM obs_tag_binding WHERE source = ? AND external_id = ?')
        .get(source, externalId);

      return row?.tag_id ?? null;
    },

    async listBindings(tagId) {
      return db
        .prepare('SELECT source, external_id, tag_id FROM obs_tag_binding WHERE tag_id = ?')
        .all(tagId)
        .map((row) => ({
          source: row.source,
          externalId: row.external_id,
          tagId: row.tag_id
        }));
    },

    async getMeta(key) {
      return db.prepare('SELECT value FROM obs_meta WHERE key = ?').get(key)?.value ?? null;
    },

    async setMeta(key, value) {
      db.prepare(
        `INSERT INTO obs_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).run(key, value);
    },

    async close() {
      db.close();
    }
  };
};

/** ---------------------------- factory ---------------------------- */
export const createRepository = async ({ driver, dataDir }) => {
  const wanted = (driver || 'auto').toLowerCase();

  if (wanted === 'memory') return createMemoryRepository();

  if (wanted === 'sqlite' || wanted === 'auto') {
    try {
      const file =
        process.env.OBS_DB_FILE || path.join(dataDir || '.', 'observability.db');

      return await createSqliteRepository({ file });
    } catch (error) {
      if (wanted === 'sqlite') {
        throw new Error(
          `SQLite driver unavailable (Node >= 22 required): ${error.message}`
        );
      }

      console.warn(
        '[observability] sqlite unavailable, falling back to memory:',
        error.message
      );

      return createMemoryRepository();
    }
  }

  throw new Error(
    `Unsupported OBS_DB_DRIVER "${driver}". Use memory | sqlite (postgres adapter not implemented yet).`
  );
};
