'use client';

/**
 * The persistent panel beside the volcano: what is selected, and what is known about it.
 *
 * It costs **no request**. A volcano point already carries the gene, its log2 fold change, its
 * padj and its −log10(padj), so the minimal detail card reads them out of the cloud that the
 * plot and the synthesis strip already share. Expression boxplots, enriched-term membership and
 * STRING partners are later slices; this one exists so that clicking a point has somewhere to
 * land, which is what makes the plot feel connected at all.
 *
 * Three states, branched on how many genes are selected: nothing, one gene, several.
 */

import { useMemo } from 'react';
import { Dataset } from '@/types';
import { useComparisonActions, useSelection, useThresholds, useViewPreferences } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { isSignificant, type VolcanoPoint } from '@/utils/volcano';
import { buildGeneIndex, normalizeGeneKey } from '@/utils/geneKeys';
import { getPalette } from '@/utils/chartPalettes';
import { PValToken } from '@/components/ui/pval-token';
import BookmarkButton from '@/components/BookmarkButton';
import { GeneToken } from '@/components/ui/gene-token';
import MultiSelectionCard from './MultiSelectionCard';

interface Props {
  dataset: Dataset;
  comparisonName: string;
}

export default function SelectionCard({ dataset, comparisonName }: Props) {
  const selection = useSelection();
  const thresholds = useThresholds();
  const { colorblind } = useViewPreferences();
  const { setFocusedGene, clearSelection } = useComparisonActions();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const { data } = useVolcanoPoints(dataset.id, comparisonName);

  /** Point lookup by any spelling of a gene — the volcano and a URL may not agree on casing. */
  const pointByGene = useMemo(() => {
    const map = new Map<string, VolcanoPoint>();
    for (const point of data?.points ?? []) {
      const key = normalizeGeneKey(point.gene);
      if (key && !map.has(key)) map.set(key, point);
    }
    return map;
  }, [data?.points]);

  const lookup = useMemo(
    () => buildGeneIndex((data?.points ?? []).map((p) => ({ id: p.gene }))),
    [data?.points]
  );

  const shell = (children: React.ReactNode) => (
    <aside
      className="gl-card p-4"
      style={{
        borderRadius: 'var(--radius-panel)',
        position: 'sticky',
        top: 'calc(var(--topbar-height) + 1rem)',
      }}
      aria-label="Selected genes"
      data-testid="selection-card"
    >
      {children}
    </aside>
  );

  if (selection.genes.length === 0) {
    return shell(
      <div className="py-6 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          No gene selected
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          Click a point in the volcano to see its fold change and significance here.
        </p>
      </div>
    );
  }

  // A focused gene wins: it is what the user last pointed at. Otherwise a set describes itself.
  if (!selection.focusedGene && selection.genes.length > 1) {
    return shell(<MultiSelectionCard dataset={dataset} comparisonName={comparisonName} />);
  }

  {
    const gene = selection.focusedGene ?? selection.genes[0];
    const point = pointByGene.get(normalizeGeneKey(gene));
    const others = selection.genes.filter((g) => normalizeGeneKey(g) !== normalizeGeneKey(gene));

    return shell(
      <>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="gene-symbol truncate text-base" title={gene}>
              {gene}
            </h3>
            {/* The volcano's gene column is chosen by heuristic, so it may be an accession or a
                symbol; saying which one this is would be a guess. */}
            {point ? (
              <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                {isSignificant(point, thresholds)
                  ? point.x > 0
                    ? 'Upregulated at these thresholds'
                    : 'Downregulated at these thresholds'
                  : 'Not significant at these thresholds'}
              </p>
            ) : null}
          </div>
          <BookmarkButton
            projectId={dataset.project_id}
            geneSymbol={gene}
            size="sm"
            variant="icon"
          />
        </div>

        {point ? (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                log2 fold change
              </dt>
              <dd
                className="font-mono font-semibold"
                style={{ color: point.x > 0 ? palette.up : palette.down }}
              >
                {point.x > 0 ? '+' : ''}
                {point.x.toFixed(2)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                padj
              </dt>
              <dd>
                <PValToken value={point.padj.toExponential(2)} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-xs" style={{ color: 'var(--text-muted)' }}>
                −log10 padj
              </dt>
              <dd className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                {point.y.toFixed(1)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {lookup.size === 0
              ? 'Loading this comparison…'
              : 'This gene is not among the plotted points, so no statistics are available here.'}
          </p>
        )}

        {others.length > 0 ? (
          <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="mb-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Also selected
            </p>
            <button
              type="button"
              onClick={() => setFocusedGene(null)}
              className="mb-2 text-xs underline"
              style={{ color: 'var(--sl-teal-dark)' }}
            >
              Back to the {(others.length + 1).toLocaleString('en-US')} selected
            </button>
            <div className="flex flex-wrap gap-1.5">
              {others.slice(0, 12).map((other) => (
                <button
                  key={other}
                  type="button"
                  onClick={() => setFocusedGene(other)}
                  title={`Show ${other}`}
                >
                  <GeneToken symbol={other} />
                </button>
              ))}
              {others.length > 12 ? (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  +{(others.length - 12).toLocaleString('en-US')} more
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={clearSelection}
          className="mt-4 text-xs underline"
          style={{ color: 'var(--sl-teal-dark)' }}
        >
          Clear selection
        </button>
      </>
    );
  }

}
