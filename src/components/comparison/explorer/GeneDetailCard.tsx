'use client';

/**
 * One gene, in as much detail as this comparison can honestly give.
 *
 * Four sources, in increasing order of what they cost:
 *
 * 1. **Fold change and significance** — free. A volcano point already carries them, so this
 *    reads the cloud the plot and the synthesis strip already share.
 * 2. **Expression across the conditions** — the panel that was orphaned. Its props were still
 *    being computed in `ComparisonDetail` while the component itself was mounted nowhere.
 * 3. **Enriched pathways containing the gene** — an inverted index over `genes`, which every
 *    enrichment payload already returns. One request per comparison, deferred until a gene is
 *    actually focused.
 * 4. **Interaction partners** — `POST /integrations/string/partners`, which existed, was
 *    documented for exactly this, and had no caller until now.
 *
 * What is deliberately absent: the gene's full GO annotation set independent of this
 * comparison. `go_annotations.gene_symbol` is indexed and `go_service.get_gene_annotations`
 * already filters on it, but nothing exposes it — a thin endpoint away, and not worth blocking
 * this card on, since (3) covers the question most people are actually asking.
 */

import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { Dataset } from '@/types';
import {
  useComparisonActions,
  useSelection,
  useThresholds,
  useViewPreferences,
} from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useGeneExpressionByCondition } from '@/hooks/useGeneExpressionByCondition';
import { useGeneToPathways } from '@/hooks/useGeneToPathways';
import { useStringPartners } from '@/hooks/useStringPartners';
import { isSignificant, type VolcanoPoint } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import { getPalette } from '@/utils/chartPalettes';
import { PValToken } from '@/components/ui/pval-token';
import { GeneToken } from '@/components/ui/gene-token';
import BookmarkButton from '@/components/BookmarkButton';
import GeneExpressionBoxplot from '@/components/GeneExpressionBoxplot';

/** Pathways listed before the rest are folded away. */
const PATHWAYS_SHOWN = 5;

interface Props {
  gene: string;
  dataset: Dataset;
  comparisonName: string;
  matrixDataset?: Dataset;
  enrichmentDataset?: Dataset;
  sampleIds?: string[];
  conditionBySample?: Record<string, string>;
  /** Symbol to query STRING with, when the gene key is an accession. */
  symbol?: string;
}

export default function GeneDetailCard({
  gene,
  dataset,
  comparisonName,
  matrixDataset,
  enrichmentDataset,
  sampleIds,
  conditionBySample,
  symbol,
}: Props) {
  const selection = useSelection();
  const thresholds = useThresholds();
  const { colorblind } = useViewPreferences();
  const { setFocusedGene, selectGenes, clearSelection } = useComparisonActions();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const { data: cloud } = useVolcanoPoints(dataset.id, comparisonName);

  const point = useMemo<VolcanoPoint | undefined>(() => {
    const key = normalizeGeneKey(gene);
    return (cloud?.points ?? []).find((candidate) => normalizeGeneKey(candidate.gene) === key);
  }, [cloud?.points, gene]);

  const expression = useGeneExpressionByCondition({
    matrixDatasetId: matrixDataset?.id,
    gene,
    comparisonName,
    sampleIds,
    conditionBySample,
  });

  const { index: pathwayIndex, isLoading: pathwaysLoading } = useGeneToPathways({
    enrichmentDatasetId: enrichmentDataset?.id,
    comparisonName,
    enabled: true,
  });
  const pathways = pathwayIndex.get(normalizeGeneKey(gene)) ?? [];

  // STRING keys on symbols, so an Ensembl accession would find nothing. Query the symbol when
  // one is known, and say so rather than showing an empty list.
  const stringQuery = symbol || (/^ENS[A-Z]*\d/i.test(gene) ? '' : gene);
  const { data: partners, isLoading: partnersLoading } = useStringPartners(stringQuery);

  const others = selection.genes.filter(
    (candidate) => normalizeGeneKey(candidate) !== normalizeGeneKey(gene)
  );

  const label = symbol && symbol !== gene ? symbol : gene;

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="gene-symbol truncate text-base" title={gene}>
            {label}
          </h3>
          {symbol && symbol !== gene ? (
            <p className="truncate text-xs font-mono" style={{ color: 'var(--text-muted)' }} title={gene}>
              {gene}
            </p>
          ) : null}
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
        </dl>
      ) : (
        <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          This gene is not among the plotted points, so no statistics are available here.
        </p>
      )}

      {/* Expression — the panel that was computed for and mounted nowhere */}
      {matrixDataset ? (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            Expression by condition
          </p>
          <GeneExpressionBoxplot
            data={expression.data}
            loading={expression.isLoading}
            height={190}
            colorblind={colorblind}
          />
        </div>
      ) : null}

      {/* Enriched pathways containing this gene */}
      {enrichmentDataset ? (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <p className="mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {pathwaysLoading
              ? 'Looking through the enriched pathways…'
              : pathways.length === 0
                ? 'In no enriched pathway of this comparison'
                : `In ${pathways.length.toLocaleString('en-US')} enriched pathway${
                    pathways.length === 1 ? '' : 's'
                  }`}
          </p>
          <ul className="space-y-1">
            {pathways.slice(0, PATHWAYS_SHOWN).map((pathway) => (
              <li key={pathway.id} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate" style={{ color: 'var(--text-primary)' }} title={pathway.name}>
                  {pathway.name}
                </span>
                {pathway.padj !== null ? (
                  <PValToken value={pathway.padj.toExponential(1)} className="shrink-0 !text-[11px]" />
                ) : null}
              </li>
            ))}
          </ul>
          {pathways.length > PATHWAYS_SHOWN ? (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              +{(pathways.length - PATHWAYS_SHOWN).toLocaleString('en-US')} more
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Interaction partners */}
      <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          Interaction partners
          {stringQuery ? (
            <a
              href={`https://string-db.org/network/${encodeURIComponent(stringQuery)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--sl-teal-dark)' }}
              title="Open in STRING"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </p>
        {!stringQuery ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            STRING is keyed on gene symbols, and this dataset gives accessions only.
          </p>
        ) : partnersLoading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Asking STRING…
          </p>
        ) : !partners || partners.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No high-confidence partner reported.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {partners.map((partner) => (
              <button
                key={partner.name}
                type="button"
                onClick={() => selectGenes([partner.name], 'network')}
                title={
                  partner.annotation
                    ? `${partner.annotation} — confidence ${partner.score.toFixed(2)}`
                    : `Confidence ${partner.score.toFixed(2)}`
                }
              >
                <GeneToken symbol={partner.name} />
              </button>
            ))}
          </div>
        )}
      </div>

      {others.length > 0 ? (
        <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
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
