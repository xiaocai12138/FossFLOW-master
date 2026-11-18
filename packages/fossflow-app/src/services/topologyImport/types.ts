/**
 * 服务拓扑导入的统一契约。
 *
 * 这些类型只描述后端下发的规范化结构，不描述任何具体基础设施产品的响应格式。
 * 来源识别与厂商私有字段解析全部在后端完成，前端只消费这里定义的字段。
 */

export type NodeKind =
  | 'SERVICE'
  | 'INSTANCE'
  | 'DATABASE'
  | 'CACHE'
  | 'MQ'
  | 'GATEWAY'
  | 'EXTERNAL';

export type Health = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'UNKNOWN';

export interface RegistryInstance {
  id: string;
  health: string;
  weight?: number;
}

export interface RegistryNode {
  tagId: string;
  kind: NodeKind;
  name: string;
  health: Health;
  labels?: Record<string, string>;
  instances?: RegistryInstance[];
}

export interface RegistryEdge {
  from: string;
  to: string;
  kind?: string;
}

export interface RegistryCatalog {
  source?: string;
  fetchedAt?: string;
  nodes: RegistryNode[];
  edges: RegistryEdge[];
  warnings?: string[];
}

export interface RegistrySourceInfo {
  name: string;
  displayName: string;
  health: { ok: boolean; detail?: string };
}

export interface ImportOptions {
  includeInstances?: boolean;
  replace?: boolean;
  columnStep?: number;
  rowStep?: number;
}

export interface ImportPreview {
  catalog: RegistryCatalog;
  nodes: RegistryNode[];
  edges: RegistryEdge[];
  warnings: string[];
}
