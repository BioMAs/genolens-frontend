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
import { StringNetworkError, useStringNetwork } from '@/hooks/useStringNetwork';
import { isSignificant, UNKNOWN_GENE } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import { stringTaxon, symbolLookup, toStringSymbol, toStringSymbols } from './stringSeeds';
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

/** How the organism STRING was asked about reads in the caption. */
const ORGANISM_LABEL: Record<number, string> = {
  9606: 'human',
  10090: 'mouse',
  10116: 'rat',
  7955: 'zebrafish',
  9823: 'pig',
  8090: 'medaka',
};

interface Props {
  dataset: Dataset;
  comparisonName: string;
  /** `gene_id → gene_name` from the matrix, to ask STRING for symbols rather than raw ids. */
  geneNameMap?: Record<string, string>;
  /** The project's declared species, when it has one. */
  projectSpecies?: string | null;
}

export default function PPINetworkSection({
  dataset,
  comparisonName,
  geneNameMap,
  projectSpecies,
}: Props) {
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

  const {
    data: cloud,
    isLoading: cloudLoading,
    isError: cloudFailed,
  } = useVolcanoPoints(dataset.id, comparisonName);

  const symbols = useMemo(() => symbolLookup(geneNameMap), [geneNameMap]);

  /**
   * What each gene did in this comparison — the join that colours the nodes.
   *
   * Keyed by the raw id AND by the symbol STRING will name the node with: a volcano keyed by
   * Ensembl id otherwise left every node grey.
   */
  const factsByGene = useMemo(() => {
    const map = new Map<string, NodeFacts>();
    for (const point of cloud?.points ?? []) {
      if (!isSignificant(point, thresholds)) continue;
      const facts: NodeFacts = { regulation: point.x > 0 ? 'up' : 'down', logFc: point.x };
      for (const name of [point.gene, toStringSymbol(point.gene ?? '', symbols)]) {
        const key = normalizeGeneKey(name);
        if (key && !map.has(key)) map.set(key, facts);
      }
    }
    return map;
  }, [cloud?.points, thresholds, symbols]);

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
  const rawSeeds =
    source === 'pathway' ? focusedTerm!.genes : source === 'selection' ? selection.genes : topDegs;
  // Symbols, unversioned: what STRING resolves. See `stringSeeds` for what the raw ids did.
  const seeds = useMemo(() => toStringSymbols(rawSeeds, symbols), [rawSeeds, symbols]);
  const declaredSpecies =
    typeof dataset.dataset_metadata?.species === 'string'
      ? dataset.dataset_metadata.species
      : projectSpecies;
  // Only the fallback: the server asks STRING about the species the analysis was launched with
  // whenever the dataset records one, and this guess only for a dataset that records none.
  const guessedSpecies = useMemo(
    () => stringTaxon(declaredSpecies, rawSeeds),
    [declaredSpecies, rawSeeds]
  );

  const { data, isLoading, isError, error } = useStringNetwork({
    symbols: seeds,
    species: guessedSpecies,
    datasetId: dataset.id,
    limit: partnersPerSeed,
    enabled: seeds.length > 0,
  });
  const stringError = error instanceof StringNetworkError ? error : null;
  const notFound = stringError?.kind === 'not-found';
  // The organism STRING was actually asked about — unknown until it answers, since the analysis
  // may overrule the guess. Naming the guess meanwhile would flash "mouse" over a rat project.
  const askedSpecies = data?.species ?? stringError?.species;
  const speciesSource = data?.species_source ?? stringError?.speciesSource;
  const organism =
    askedSpecies !== undefined ? (ORGANISM_LABEL[askedSpecies] ?? `taxon ${askedSpecies}`) : null;

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

  // The fallback seeds come from the volcano cloud. While it loads, or when it failed, the list
  // is empty for a reason that is not "no significant gene" — and saying so sent people
  // loosening thresholds on a comparison that had thousands of DEGs.
  if (seeds.length === 0 && source === 'top' && cloudLoading) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading this comparison&apos;s genes…
      </p>
    );
  }
  if (seeds.length === 0 && source === 'top' && cloudFailed) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        This comparison&apos;s genes could not be loaded, so there is nothing to build a network
        from yet. Reload the page to try again.
      </p>
    );
  }
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
          <span style={{ color: 'var(--text-muted)' }}>
            {' '}
            · STRING{organism ? `, ${organism}` : ''}
          </span>
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
          className="inline-flex items-center gap-1.5 bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink"
          style={{ borderRadius: 'var(--radius-control)' }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          {data.dropped.toLocaleString('en-US')} gene{data.dropped === 1 ? '' : 's'} left out —
          STRING accepts {MAX_SEED_GENES} at a time, so the strongest fold changes were kept.
        </p>
      ) : null}

      {trimmed && trimmed.hidden > 0 ? (
        <p
          className="inline-flex items-center gap-1.5 bg-warning-soft px-2.5 py-1.5 text-xs text-warning-ink"
          style={{ borderRadius: 'var(--radius-control)' }}
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
        ) : notFound ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            STRING recognised none of these {seeds.length.toLocaleString('en-US')} genes as{' '}
            {organism ?? 'this organism’s'} proteins —{' '}
            {speciesSource === 'dataset'
              ? 'the species this analysis was launched with.'
              : 'the organism is inferred from the gene identifiers.'}
          </p>
        ) : isError ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            STRING could not be reached. Try again in a moment.
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
            <summary className="cursor-pointer text-xs text-accent-ink">
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
