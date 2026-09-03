'use client';

/**
 * The interaction network of this comparison's genes.
 *
 * Replaces a hand-rolled SVG that was decorative rather than useful: a fixed 600×420 circular
 * layout, capped at forty nodes "for legibility", with no zoom, no pan, no hover — and seeded
 * from `allMatrixGenes.slice(0, 50)`, arbitrary genes rather than the ones anyone was looking
 * at. Every one of those is addressed here.
 *
 * **Where the genes come from**, in order: a pathway being looked through, so clicking an
 * enriched term a scroll away rebuilds the graph around it; then the shared selection, so a
 * lasso in the volcano becomes a network; failing both, the comparison's strongest DEGs —
 * never arbitrary matrix genes. The panel always says which of the three it is using, so the
 * graph is never silently wrong about what it shows.
 */

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertTriangle, Maximize2 } from 'lucide-react';
import { Dataset } from '@/types';
import {
  useComparisonActions,
  useFocusedTerm,
  useSelection,
  useThresholds,
} from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useStringNetwork } from '@/hooks/useStringNetwork';
import { isSignificant, UNKNOWN_GENE } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import type { NodeFacts } from '@/types/network';
import {
  DEFAULT_NODE_CAP,
  MAX_SEED_GENES,
  toCytoscapeElements,
  topNByDegree,
  toTableRows,
} from './cytoscapeAdapters';

const PPINetworkGraph = dynamic(() => import('./PPINetworkGraph'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center text-sm"
      style={{ height: 'clamp(420px, 62vh, 760px)', color: 'var(--text-muted)' }}
    >
      Loading the network renderer…
    </div>
  ),
});

/** Seeds used when nothing is selected. Comfortably under the server's hundred-gene cap. */
const FALLBACK_SEEDS = 60;

const NODE_CAPS = [50, 100, DEFAULT_NODE_CAP, 0] as const;

interface Props {
  dataset: Dataset;
  comparisonName: string;
}

export default function PPINetworkSection({ dataset, comparisonName }: Props) {
  const selection = useSelection();
  const focusedTerm = useFocusedTerm();
  const thresholds = useThresholds();
  const { selectGenes } = useComparisonActions();

  // Stable, because the graph effect depends on it: a fresh arrow each render would rebuild
  // and re-lay-out the whole network.
  const handleNodeClick = useCallback(
    (gene: string) => selectGenes([gene], 'network'),
    [selectGenes]
  );

  const [nodeCap, setNodeCap] = useState<number>(DEFAULT_NODE_CAP);
  const [expanded, setExpanded] = useState(false);
  const [partnersPerSeed, setPartnersPerSeed] = useState(10);

  const { data: cloud } = useVolcanoPoints(dataset.id, comparisonName);

  /** What each gene did in this comparison — the join that colours the nodes. */
  const factsByGene = useMemo(() => {
    const map = new Map<string, NodeFacts>();
    for (const point of cloud?.points ?? []) {
      const key = normalizeGeneKey(point.gene);
      if (!key || map.has(key)) continue;
      if (!isSignificant(point, thresholds)) continue;
      map.set(key, { regulation: point.x > 0 ? 'up' : 'down', logFc: point.x });
    }
    return map;
  }, [cloud?.points, thresholds]);

  /** Strongest DEGs first, so trimming to the server's cap drops the least interesting. */
  const topDegs = useMemo(() => {
    return (cloud?.points ?? [])
      .filter((point) => point.gene && point.gene !== UNKNOWN_GENE && isSignificant(point, thresholds))
      .sort((a, b) => Math.abs(b.x) - Math.abs(a.x))
      .slice(0, FALLBACK_SEEDS)
      .map((point) => point.gene);
  }, [cloud?.points, thresholds]);

  // A pathway wins over a lasso: it is the more deliberate act, and the one the reader just
  // performed on this very screen.
  const source: 'pathway' | 'selection' | 'top' =
    focusedTerm && focusedTerm.genes.length > 0
      ? 'pathway'
      : selection.genes.length > 0
        ? 'selection'
        : 'top';
  const seeds =
    source === 'pathway' ? focusedTerm!.genes : source === 'selection' ? selection.genes : topDegs;

  const { data, isLoading, isError } = useStringNetwork({
    symbols: seeds,
    limit: partnersPerSeed,
    enabled: seeds.length > 0,
  });

  const trimmed = useMemo(() => {
    if (!data) return null;
    const cap = nodeCap > 0 ? nodeCap : data.nodes.length;
    return { network: topNByDegree(data, cap), hidden: Math.max(0, data.nodes.length - cap) };
  }, [data, nodeCap]);

  const elements = useMemo(
    () => (trimmed ? toCytoscapeElements(trimmed.network, factsByGene) : { nodes: [], edges: [] }),
    [trimmed, factsByGene]
  );

  const rows = useMemo(
    () => (trimmed ? toTableRows(trimmed.network, factsByGene) : []),
    [trimmed, factsByGene]
  );

  const counts = useMemo(() => {
    let up = 0;
    let down = 0;
    for (const row of rows) {
      if (row.regulation === 'up') up += 1;
      else if (row.regulation === 'down') down += 1;
    }
    return { up, down, neutral: rows.length - up - down };
  }, [rows]);

  const ariaLabel =
    `Interaction network: ${rows.length.toLocaleString('en-US')} proteins, ` +
    `${(trimmed?.network.edges.length ?? 0).toLocaleString('en-US')} interactions, ` +
    `${counts.up.toLocaleString('en-US')} upregulated, ${counts.down.toLocaleString('en-US')} downregulated`;

  const controlStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-control)',
    color: 'var(--text-primary)',
  };

  const requestFullscreen = () => {
    const element = document.getElementById('ppi-network-frame');
    if (element?.requestFullscreen) void element.requestFullscreen();
    else setExpanded((value) => !value);
  };

  if (seeds.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        No significant gene at these thresholds, so there is nothing to build a network from.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="ppi-network-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {source === 'pathway' ? (
            <>
              Built from the <strong>{focusedTerm!.genes.length.toLocaleString('en-US')}</strong>{' '}
              gene{focusedTerm!.genes.length === 1 ? '' : 's'} of{' '}
              <strong>{focusedTerm!.name}</strong>
            </>
          ) : source === 'selection' ? (
            <>
              Built from your selection of{' '}
              <strong>{selection.genes.length.toLocaleString('en-US')}</strong> gene
              {selection.genes.length === 1 ? '' : 's'}
              {selection.label ? ` · ${selection.label}` : ''}
            </>
          ) : (
            <>
              Showing the top {topDegs.length.toLocaleString('en-US')} DEGs by |log2FC| — select
              genes in the volcano, or a pathway, to change this
            </>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Partners per gene
            <select
              aria-label="Partners per gene"
              value={partnersPerSeed}
              onChange={(e) => setPartnersPerSeed(Number(e.target.value))}
              className="px-2 py-1 text-xs"
              style={controlStyle}
            >
              {/* No zero: the endpoint declares ge=1, so "seeds only" is a 422. */}
              {[1, 5, 10, 25, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Nodes
            <select
              aria-label="Maximum nodes by degree"
              value={nodeCap}
              onChange={(e) => setNodeCap(Number(e.target.value))}
              className="px-2 py-1 text-xs"
              style={controlStyle}
            >
              {NODE_CAPS.map((cap) => (
                <option key={cap} value={cap}>
                  {cap === 0 ? 'All' : `Top ${cap}`}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={requestFullscreen}
            className="inline-flex items-center gap-1.5 px-2 py-1 text-xs"
            style={controlStyle}
            title="Full screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </button>
        </div>
      </div>

      {data && data.dropped > 0 ? (
        <p
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          style={{
            background: 'rgba(245,158,11,0.12)',
            borderRadius: 'var(--radius-control)',
            color: '#b45309',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {data.dropped.toLocaleString('en-US')} gene{data.dropped === 1 ? '' : 's'} left out —
          STRING accepts {MAX_SEED_GENES} at a time, so the strongest fold changes were kept.
        </p>
      ) : null}

      {trimmed && trimmed.hidden > 0 ? (
        <p
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
          style={{
            background: 'rgba(245,158,11,0.12)',
            borderRadius: 'var(--radius-control)',
            color: '#b45309',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Showing the {nodeCap.toLocaleString('en-US')} best-connected of{' '}
          {(data?.nodes.length ?? 0).toLocaleString('en-US')} proteins.{' '}
          <button type="button" onClick={() => setNodeCap(0)} className="underline">
            Show all anyway
          </button>
        </p>
      ) : null}

      <div id="ppi-network-frame">
        {isLoading ? (
          <div
            className="flex items-center justify-center text-sm"
            style={{ height: 'clamp(420px, 62vh, 760px)', color: 'var(--text-muted)' }}
          >
            Asking STRING for interactions…
          </div>
        ) : isError ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            STRING could not be reached.
          </p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No interaction reported for these genes at this confidence.
          </p>
        ) : (
          <PPINetworkGraph
            elements={elements}
            height={expanded ? 'calc(100vh - var(--topbar-height) - 24px)' : 'clamp(420px, 62vh, 760px)'}
            ariaLabel={ariaLabel}
            onNodeClick={handleNodeClick}
          />
        )}
      </div>

      {rows.length > 0 ? (
        <>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Node colour is the direction in this comparison; grey is a partner STRING added that
            is not a DEG here. Size is how many interactions it has. Arrows pan, + and − zoom,
            0 refits.
          </p>

          {/* Canvas is opaque to assistive technology, so the same data as rows — which is
              also the fastest way for anyone to read off the hubs. */}
          <details>
            <summary className="cursor-pointer text-xs" style={{ color: 'var(--sl-teal-dark)' }}>
              Network as a table
            </summary>
            <div className="mt-2 max-h-80 overflow-auto">
              <table className="data-table min-w-full">
                <thead>
                  <tr>
                    <th>Gene</th>
                    <th>Direction</th>
                    <th>Log2FC</th>
                    <th>Interactions</th>
                    <th>Top partners</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.gene}>
                      <td>
                        <span className="gene-symbol">{row.gene}</span>
                      </td>
                      <td>{row.regulation === 'neutral' ? 'not a DEG here' : row.regulation}</td>
                      <td className="font-mono">
                        {row.logFc === undefined ? '–' : row.logFc.toFixed(2)}
                      </td>
                      <td>{row.degree.toLocaleString('en-US')}</td>
                      <td>{row.partners.join(', ') || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}
