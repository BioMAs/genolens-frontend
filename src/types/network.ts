/**
 * The protein-interaction network, as `POST /integrations/string/network` returns it.
 *
 * These interfaces lived inside `ExternalIntegrationsPanel`. Three modules need them now that
 * the panel is split, so they belong here.
 */

export interface NetworkNode {
  id: string;
  /** Gene symbol — STRING keys on `preferredName`, which joins straight onto DEG data. */
  name: string;
  annotation?: string;
  string_id?: string;
}

export interface NetworkEdge {
  source: string;
  target: string;
  /** STRING confidence, 0–1. */
  score: number;
  /** Bucketed from the score by the backend: highest / high / medium / … */
  evidence?: string;
}

export interface PPINetwork {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  species?: number;
  count?: number;
}

/** How a gene moved in the comparison, for colouring a node. */
export type NodeRegulation = 'up' | 'down' | 'neutral';

/** What the graph knows about one gene, joined from the DEG side. */
export interface NodeFacts {
  regulation: NodeRegulation;
  logFc?: number;
}
