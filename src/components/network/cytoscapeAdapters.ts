/**
 * Pure functions between the STRING payload and cytoscape.
 *
 * Everything testable about the network lives here, because the renderer itself cannot be:
 * cytoscape draws to canvas, and jsdom has neither WebGL nor layout. So the adapters carry the
 * coverage — the DEG join, the degree computation, the node cap, the server's gene limit and
 * the stylesheet — and the renderer stays a thin imperative shell over them.
 */

import type { StylesheetJson } from 'cytoscape';
import { normalizeGeneKey } from '@/utils/geneKeys';
import type {
  NetworkEdge,
  NetworkNode,
  NodeFacts,
  NodeRegulation,
  PPINetwork,
} from '@/types/network';

/**
 * Hard cap on the request, not a display choice.
 *
 * `POST /integrations/string/network` declares `gene_symbols: list[str] = Field(..., max_length=100)`
 * and clamps again inside the service. Over a hundred symbols is a **422**, so the client has to
 * cut the list and say it did.
 */
export const MAX_SEED_GENES = 100;

/** Nodes drawn before the graph is trimmed to its best-connected part. */
export const DEFAULT_NODE_CAP = 300;

export interface CytoscapeElement {
  data: Record<string, unknown>;
  classes?: string;
}

export interface CytoscapeElements {
  nodes: CytoscapeElement[];
  edges: CytoscapeElement[];
}

/**
 * Trim a symbol list to what the endpoint accepts, keeping the strongest first.
 *
 * `order` is the caller's ranking — by |log2FC| when the seeds come from DEG data — so the cut
 * removes the least interesting genes rather than an arbitrary tail.
 */
export function clampSymbols(symbols: string[], limit = MAX_SEED_GENES): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const symbol of symbols) {
    const key = normalizeGeneKey(symbol);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(symbol);
    if (kept.length >= limit) break;
  }
  return kept;
}

/**
 * Keep the `n` best-connected nodes, and only the edges whose both ends survive.
 *
 * The previous hand-rolled SVG did the same thing at forty nodes with a `nodeSet` filter and no
 * test. Dropping an edge whose endpoint is gone matters: cytoscape throws on an edge that
 * references a missing node.
 */
export function topNByDegree(network: PPINetwork, n: number): PPINetwork {
  if (network.nodes.length <= n) return network;

  const degree = new Map<string, number>();
  for (const edge of network.edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const kept = [...network.nodes]
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))
    .slice(0, n);
  const keptIds = new Set(kept.map((node) => node.id));

  return {
    ...network,
    nodes: kept,
    edges: network.edges.filter((edge) => keptIds.has(edge.source) && keptIds.has(edge.target)),
  };
}

/** Degree per node id, so the renderer does not have to ask cytoscape after layout. */
export function degreeById(nodes: NetworkNode[], edges: NetworkEdge[]): Map<string, number> {
  const degree = new Map<string, number>(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (degree.has(edge.source)) degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    if (degree.has(edge.target)) degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }
  return degree;
}

/**
 * Join the network onto the comparison's DEG data.
 *
 * The join is free: STRING keys nodes on `preferredName`, the gene symbol, which is what the
 * DEG side calls them too — no mapping table.
 *
 * A node with no DEG row gets `neutral`, and that grey is **informative**: it is a partner
 * STRING brought in, not a gene of this comparison. It mirrors the GO tree's own "grey means
 * context, not result" convention, so the product speaks with one voice.
 */
export function toCytoscapeElements(
  network: PPINetwork,
  /** Keyed by `normalizeGeneKey(gene)`. The lookup normalises the node's name, not the map. */
  factsByGene: Map<string, NodeFacts>
): CytoscapeElements {
  const degree = degreeById(network.nodes, network.edges);
  const maxDegree = Math.max(1, ...degree.values());

  const nodes = network.nodes.map((node) => {
    const facts = factsByGene.get(normalizeGeneKey(node.name)) ?? factsByGene.get(normalizeGeneKey(node.id));
    const regulation: NodeRegulation = facts?.regulation ?? 'neutral';
    return {
      data: {
        id: node.id,
        label: node.name,
        annotation: node.annotation ?? '',
        regulation,
        logFc: facts?.logFc,
        // Written here rather than read off cytoscape: mapData() cannot call degree().
        degree: degree.get(node.id) ?? 0,
        maxDegree,
      },
      classes: regulation,
    };
  });

  const nodeIds = new Set(network.nodes.map((node) => node.id));
  const edges = network.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      data: {
        id: `${edge.source}--${edge.target}`,
        source: edge.source,
        target: edge.target,
        score: edge.score,
        evidence: edge.evidence ?? '',
      },
    }));

  return { nodes, edges };
}

export interface GraphTheme {
  up: string;
  down: string;
  neutral: string;
  surface: string;
  border: string;
  label: string;
}

const FALLBACK_THEME: GraphTheme = {
  up: '#22c55e',
  down: '#ef4444',
  neutral: '#8b93a0',
  surface: '#ffffff',
  border: '#c7ccd4',
  label: '#1a1f2e',
};

/**
 * Read the design tokens cytoscape cannot resolve itself.
 *
 * Cytoscape stylesheets take literal colour strings, so `var(--dc-up)` means nothing to it.
 *
 * **Must be called after paint, in an effect keyed on the theme.** `ThemeContext` toggles the
 * `.dark` class inside an effect, so reading during render returns the *previous* theme's
 * values — the single most likely bug in this file.
 */
export function readGraphTheme(root?: HTMLElement | null): GraphTheme {
  if (typeof window === 'undefined') return FALLBACK_THEME;
  const element = root ?? document.documentElement;
  const style = window.getComputedStyle(element);
  // .trim() is required: a computed custom property keeps the whitespace after the colon.
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;

  return {
    up: read('--dc-up', FALLBACK_THEME.up),
    down: read('--dc-down', FALLBACK_THEME.down),
    neutral: read('--text-muted', FALLBACK_THEME.neutral),
    surface: read('--surface', FALLBACK_THEME.surface),
    border: read('--border-strong', FALLBACK_THEME.border),
    label: read('--text-primary', FALLBACK_THEME.label),
  };
}

/** Cytoscape stylesheet for a given theme. Snapshot-tested — a token typo is invisible on canvas. */
export function buildStylesheet(theme: GraphTheme): StylesheetJson {
  return [
    {
      selector: 'node',
      style: {
        'background-color': theme.neutral,
        // A hub should read as a hub; degree is written into the data by the adapter.
        width: 'mapData(degree, 1, 20, 18, 46)',
        height: 'mapData(degree, 1, 20, 18, 46)',
        'border-width': 1.5,
        'border-color': theme.surface,
        label: 'data(label)',
        color: theme.label,
        'font-size': 10,
        'text-valign': 'center',
        'text-halign': 'center',
        // The single biggest legibility win over the old fixed SVG: labels vanish when zoomed
        // out instead of turning to mud.
        'min-zoomed-font-size': 8,
      },
    },
    { selector: 'node.up', style: { 'background-color': theme.up } },
    { selector: 'node.down', style: { 'background-color': theme.down } },
    { selector: 'node.neutral', style: { 'background-color': theme.neutral } },
    {
      selector: 'node:selected',
      style: { 'border-width': 3, 'border-color': theme.label },
    },
    {
      selector: 'edge',
      style: {
        'curve-style': 'straight',
        'line-color': theme.border,
        // Confidence rides on width alone. `@types/cytoscape` models `line-opacity` as a plain
        // number and rejects a mapper on it; casting to get one past the type would buy a second
        // channel for the same variable, and width is the clearer of the two anyway.
        width: 'mapData(score, 0.4, 1, 0.8, 3.5)',
        'line-opacity': 0.55,
      },
    },
  ];
}

/** One row per gene, for the accessible table beside the canvas. */
export interface NetworkTableRow {
  gene: string;
  regulation: NodeRegulation;
  logFc?: number;
  degree: number;
  partners: string[];
}

/**
 * The graph as rows.
 *
 * Canvas is opaque to assistive technology, so this is the readable equivalent — and it earns
 * its place rather than being an accessibility tax, because a sortable list of hubs and their
 * partners is genuinely useful to anyone.
 */
export function toTableRows(
  network: PPINetwork,
  /** Keyed by `normalizeGeneKey(gene)`, as in `toCytoscapeElements`. */
  factsByGene: Map<string, NodeFacts>,
  topPartners = 5
): NetworkTableRow[] {
  const nameById = new Map(network.nodes.map((node) => [node.id, node.name]));
  const partnersById = new Map<string, Array<{ name: string; score: number }>>();

  for (const edge of network.edges) {
    const push = (from: string, to: string) => {
      const name = nameById.get(to);
      if (!name) return;
      const list = partnersById.get(from) ?? [];
      list.push({ name, score: edge.score });
      partnersById.set(from, list);
    };
    push(edge.source, edge.target);
    push(edge.target, edge.source);
  }

  const degree = degreeById(network.nodes, network.edges);

  return network.nodes
    .map((node) => {
      const facts =
        factsByGene.get(normalizeGeneKey(node.name)) ?? factsByGene.get(normalizeGeneKey(node.id));
      return {
        gene: node.name,
        regulation: facts?.regulation ?? ('neutral' as NodeRegulation),
        logFc: facts?.logFc,
        degree: degree.get(node.id) ?? 0,
        partners: (partnersById.get(node.id) ?? [])
          .sort((a, b) => b.score - a.score)
          .slice(0, topPartners)
          .map((partner) => partner.name),
      };
    })
    .sort((a, b) => b.degree - a.degree);
}
