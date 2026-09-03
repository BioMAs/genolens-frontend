/**
 * The network's adapters.
 *
 * Cytoscape draws to canvas and jsdom has neither WebGL nor layout, so the renderer cannot be
 * tested — which is precisely why the DEG join, the degree computation, the node cap, the
 * server's gene limit and the stylesheet are pure functions. All the ways the graph can lie
 * about the data are reachable from here.
 */
import {
  buildStylesheet,
  clampSymbols,
  degreeById,
  MAX_SEED_GENES,
  toCytoscapeElements,
  topNByDegree,
  toTableRows,
  type GraphTheme,
} from '@/components/network/cytoscapeAdapters';
import type { NodeFacts, PPINetwork } from '@/types/network';

const network: PPINetwork = {
  nodes: [
    { id: 'n1', name: 'TP53' },
    { id: 'n2', name: 'MDM2' },
    { id: 'n3', name: 'CDKN1A' },
    { id: 'n4', name: 'LONELY' },
  ],
  edges: [
    { source: 'n1', target: 'n2', score: 0.99 },
    { source: 'n1', target: 'n3', score: 0.8 },
    { source: 'n2', target: 'n3', score: 0.7 },
  ],
};

const facts = new Map<string, NodeFacts>([
  ['TP53', { regulation: 'up', logFc: 2.4 }],
  ['MDM2', { regulation: 'down', logFc: -1.8 }],
]);

describe('clampSymbols', () => {
  it('mirrors the server cap, which is a 422 and not a display choice', () => {
    expect(MAX_SEED_GENES).toBe(100);
    const many = Array.from({ length: 150 }, (_, i) => `GENE${i}`);
    expect(clampSymbols(many)).toHaveLength(100);
  });

  // The caller ranks by |log2FC|, so the cut has to take the head, not a sample.
  it('keeps the head of the list, which is the strongest', () => {
    expect(clampSymbols(['A', 'B', 'C'], 2)).toEqual(['A', 'B']);
  });

  it('deduplicates case-insensitively before counting', () => {
    expect(clampSymbols(['Sox9', 'SOX9', 'TP53'], 2)).toEqual(['Sox9', 'TP53']);
  });

  it('drops empties rather than spending cap on them', () => {
    expect(clampSymbols(['', '  ', 'TP53'])).toEqual(['TP53']);
  });
});

describe('degreeById', () => {
  it('counts the interactions of each node', () => {
    const degree = degreeById(network.nodes, network.edges);
    expect(degree.get('n1')).toBe(2);
    expect(degree.get('n2')).toBe(2);
    expect(degree.get('n3')).toBe(2);
  });

  it('gives an unconnected node zero rather than leaving it out', () => {
    expect(degreeById(network.nodes, network.edges).get('n4')).toBe(0);
  });

  it('ignores an edge pointing at a node that is not there', () => {
    const degree = degreeById([{ id: 'n1', name: 'TP53' }], network.edges);
    expect(degree.get('n1')).toBe(2);
    expect(degree.size).toBe(1);
  });
});

describe('topNByDegree', () => {
  it('keeps the best-connected nodes', () => {
    const trimmed = topNByDegree(network, 3);
    expect(trimmed.nodes.map((n) => n.id)).not.toContain('n4');
    expect(trimmed.nodes).toHaveLength(3);
  });

  // Cytoscape throws on an edge whose endpoint is missing, so this is not cosmetic.
  it('drops an edge whose endpoint was trimmed away', () => {
    const trimmed = topNByDegree(network, 2);
    for (const edge of trimmed.edges) {
      const ids = trimmed.nodes.map((n) => n.id);
      expect(ids).toContain(edge.source);
      expect(ids).toContain(edge.target);
    }
  });

  it('leaves a network already under the cap untouched', () => {
    expect(topNByDegree(network, 10)).toBe(network);
  });
});

describe('toCytoscapeElements', () => {
  it('colours a node by what its gene did in this comparison', () => {
    const { nodes } = toCytoscapeElements(network, facts);
    const byLabel = new Map(nodes.map((n) => [n.data.label, n]));

    expect(byLabel.get('TP53')?.classes).toBe('up');
    expect(byLabel.get('MDM2')?.classes).toBe('down');
  });

  // The grey is informative: a partner STRING brought in, not a gene of this comparison.
  // Colouring it as up or down would be an invention.
  it('marks a node with no DEG row as neutral rather than guessing', () => {
    const { nodes } = toCytoscapeElements(network, facts);
    const lonely = nodes.find((n) => n.data.label === 'LONELY');

    expect(lonely?.classes).toBe('neutral');
    expect(lonely?.data.logFc).toBeUndefined();
  });

  // The map is keyed on normalised names; what varies is how STRING spells the node, and a
  // mouse gene comes back as `Sox9` where the DEG side stored `SOX9`.
  it('finds the DEG data whatever case STRING uses for the node', () => {
    const mouse: PPINetwork = {
      nodes: [{ id: 'n1', name: 'Sox9' }],
      edges: [],
    };
    const normalised = new Map<string, NodeFacts>([['SOX9', { regulation: 'up', logFc: 1 }]]);

    expect(toCytoscapeElements(mouse, normalised).nodes[0].classes).toBe('up');
  });

  // mapData() cannot call degree(), so the adapter has to write it in.
  it('writes the degree into the node data, where the stylesheet can map it', () => {
    const { nodes } = toCytoscapeElements(network, facts);
    expect(nodes.find((n) => n.data.label === 'TP53')?.data.degree).toBe(2);
    expect(nodes.find((n) => n.data.label === 'LONELY')?.data.degree).toBe(0);
  });

  it('gives every edge a stable id, since cytoscape needs one', () => {
    const { edges } = toCytoscapeElements(network, facts);
    const ids = edges.map((e) => e.data.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('refuses an edge that references a node it was not given', () => {
    const broken: PPINetwork = {
      nodes: [{ id: 'n1', name: 'TP53' }],
      edges: [{ source: 'n1', target: 'ghost', score: 0.9 }],
    };
    expect(toCytoscapeElements(broken, facts).edges).toHaveLength(0);
  });

  it('survives an empty network', () => {
    const empty = toCytoscapeElements({ nodes: [], edges: [] }, facts);
    expect(empty).toEqual({ nodes: [], edges: [] });
  });
});

describe('buildStylesheet', () => {
  const theme: GraphTheme = {
    up: '#22c55e',
    down: '#ef4444',
    neutral: '#8b93a0',
    surface: '#ffffff',
    border: '#c7ccd4',
    label: '#1a1f2e',
  };

  // A token typo is invisible on canvas, so the stylesheet is pinned.
  it('matches its snapshot', () => {
    expect(buildStylesheet(theme)).toMatchSnapshot();
  });

  it('carries the direction colours the rest of the app uses', () => {
    const sheet = buildStylesheet(theme) as Array<{ selector: string; style: Record<string, unknown> }>;
    const up = sheet.find((rule) => rule.selector === 'node.up');
    const down = sheet.find((rule) => rule.selector === 'node.down');

    expect(up?.style['background-color']).toBe('#22c55e');
    expect(down?.style['background-color']).toBe('#ef4444');
  });

  // The single biggest legibility win over the fixed SVG this replaces.
  it('hides labels when zoomed out instead of letting them turn to mud', () => {
    const sheet = buildStylesheet(theme) as Array<{ selector: string; style: Record<string, unknown> }>;
    const node = sheet.find((rule) => rule.selector === 'node');
    expect(node?.style['min-zoomed-font-size']).toBe(8);
  });
});

describe('toTableRows', () => {
  it('lists every gene, hubs first', () => {
    const rows = toTableRows(network, facts);
    expect(rows).toHaveLength(4);
    expect(rows.at(-1)?.gene).toBe('LONELY');
  });

  it('names the strongest partners of each gene', () => {
    const rows = toTableRows(network, facts);
    const tp53 = rows.find((row) => row.gene === 'TP53');
    expect(tp53?.partners).toEqual(['MDM2', 'CDKN1A']);
  });

  it('says a gene is not a DEG here rather than implying a direction', () => {
    const rows = toTableRows(network, facts);
    const lonely = rows.find((row) => row.gene === 'LONELY');
    expect(lonely?.regulation).toBe('neutral');
    expect(lonely?.logFc).toBeUndefined();
  });

  it('carries the fold change when there is one', () => {
    expect(toTableRows(network, facts).find((r) => r.gene === 'TP53')?.logFc).toBe(2.4);
  });
});
