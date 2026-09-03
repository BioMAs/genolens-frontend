'use client';

/**
 * What a set of selected genes is, and what can be done with it.
 *
 * This is where the lasso stops being a gesture and becomes work: a set of genes you can name,
 * keep, and take out of the app. Every action here runs on an endpoint that already exists —
 * gene lists, batch bookmarks and the export menu were all built and, in the first two cases,
 * reachable only from elsewhere. None of it needed a new route.
 *
 * Like the single-gene card, the statistics come free: a volcano point already carries the
 * fold change and the padj, so the whole panel reads the cloud the plot already shares.
 */

import { useMemo, useState } from 'react';
import { Bookmark, Check, ListPlus, Loader2, Sparkles } from 'lucide-react';
import { Dataset } from '@/types';
import { useComparisonActions, useSelection, useThresholds, useViewPreferences } from '@/contexts/ComparisonSelectionContext';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { useCreateBookmarksBatch, useCreateGeneList } from '@/hooks/useBookmarks';
import { useIntersectionEnrichment } from '@/hooks/useIntersectionEnrichment';
import { isSignificant, type VolcanoPoint } from '@/utils/volcano';
import { normalizeGeneKey } from '@/utils/geneKeys';
import { getPalette } from '@/utils/chartPalettes';
import { GeneToken } from '@/components/ui/gene-token';
import ExportMenu from '@/components/ExportMenu';

/** How many genes get a chip each. Beyond this the set is described, not enumerated. */
const CHIPS_SHOWN = 10;

interface Props {
  dataset: Dataset;
  comparisonName: string;
}

interface SelectedGene {
  gene: string;
  point?: VolcanoPoint;
}

export default function MultiSelectionCard({ dataset, comparisonName }: Props) {
  const selection = useSelection();
  const thresholds = useThresholds();
  const { colorblind } = useViewPreferences();
  const { setFocusedGene, clearSelection, selectGeneList } = useComparisonActions();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const { data } = useVolcanoPoints(dataset.id, comparisonName);

  const createList = useCreateGeneList();
  const bookmarkAll = useCreateBookmarksBatch();

  /**
   * Enrichment of an arbitrary gene list.
   *
   * `POST /datasets/{id}/intersection-enrichment` takes a plain list of genes, so it answers
   * "what are these genes about" for a lasso just as well as for the Venn intersection it was
   * written for. No new endpoint, and no waiting for the comparison-wide enrichment to be
   * recomputed.
   */
  const enrichment = useIntersectionEnrichment(dataset.id);
  const enrichRunning = enrichment.status === 'PENDING' || enrichment.status === 'RUNNING';

  const [listName, setListName] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const pointByGene = useMemo(() => {
    const map = new Map<string, VolcanoPoint>();
    for (const point of data?.points ?? []) {
      const key = normalizeGeneKey(point.gene);
      if (key && !map.has(key)) map.set(key, point);
    }
    return map;
  }, [data?.points]);

  const genes = useMemo<SelectedGene[]>(
    () =>
      selection.genes.map((gene) => ({
        gene,
        point: pointByGene.get(normalizeGeneKey(gene)),
      })),
    [selection.genes, pointByGene]
  );

  const summary = useMemo(() => {
    let up = 0;
    let down = 0;
    let unknown = 0;
    for (const { point } of genes) {
      if (!point) {
        // Selected from a saved list or a pathway, and absent from this comparison's cloud.
        unknown += 1;
      } else if (!isSignificant(point, thresholds)) {
        unknown += 1;
      } else if (point.x > 0) {
        up += 1;
      } else {
        down += 1;
      }
    }
    return { up, down, unknown };
  }, [genes, thresholds]);

  /** Strongest fold changes, then most significant — the two orders a biologist asks for. */
  const byFoldChange = useMemo(
    () =>
      genes
        .filter((g) => g.point)
        .sort((a, b) => Math.abs(b.point!.x) - Math.abs(a.point!.x))
        .slice(0, CHIPS_SHOWN),
    [genes]
  );

  const byPadj = useMemo(
    () =>
      genes
        .filter((g) => g.point)
        .sort((a, b) => a.point!.padj - b.point!.padj)
        .slice(0, CHIPS_SHOWN),
    [genes]
  );

  const exportRows = useMemo(
    () =>
      genes.map(({ gene, point }) => ({
        gene: gene,
        log2_fold_change: point ? point.x.toFixed(3) : '',
        adjusted_p_value: point ? point.padj.toExponential(2) : '',
        regulation: point && isSignificant(point, thresholds) ? (point.x > 0 ? 'UP' : 'DOWN') : '',
      })),
    [genes, thresholds]
  );

  const saving = createList.isPending;

  const handleSave = async () => {
    const name = listName.trim() || selection.label || `${comparisonName} selection`;
    setNotice(null);
    try {
      // GeneListCreate takes the genes directly, so this is one call rather than a create
      // followed by an add.
      const list = await createList.mutateAsync({
        projectId: dataset.project_id,
        data: { name, genes: selection.genes, description: `From ${comparisonName}` },
      });
      setListName('');
      // Re-select from the saved list rather than leaving the selection as an anonymous lasso:
      // it now has an id, so the URL can carry it and the link becomes shareable.
      selectGeneList(list.id, list.name, list.genes.length > 0 ? list.genes : selection.genes);
      setNotice(`Saved as “${list.name}” — this link now carries it`);
    } catch {
      setNotice('Could not save the list.');
    }
  };

  const handleBookmarkAll = async () => {
    setNotice(null);
    try {
      const result = await bookmarkAll.mutateAsync({
        projectId: dataset.project_id,
        data: { gene_symbols: selection.genes },
      });
      setNotice(
        `${result.created.toLocaleString('en-US')} bookmarked` +
          (result.skipped > 0
            ? `, ${result.skipped.toLocaleString('en-US')} already there`
            : '')
      );
    } catch {
      setNotice('Could not bookmark the selection.');
    }
  };

  const chipRow = (label: string, entries: SelectedGene[]) =>
    entries.length > 0 ? (
      <div>
        <p className="mb-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {entries.map(({ gene }) => (
            <button key={gene} type="button" onClick={() => setFocusedGene(gene)} title={`Show ${gene}`}>
              <GeneToken symbol={gene} />
            </button>
          ))}
        </div>
      </div>
    ) : null;

  const actionStyle: React.CSSProperties = {
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-control)',
    color: 'var(--text-secondary)',
  };

  return (
    <div className="space-y-4" data-testid="multi-selection-card">
      <div>
        <h3 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {selection.genes.length.toLocaleString('en-US')} genes selected
        </h3>
        {selection.label ? (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {selection.label}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span style={{ color: palette.up }}>
          <span className="font-semibold">{summary.up.toLocaleString('en-US')}</span> up
        </span>
        <span style={{ color: palette.down }}>
          <span className="font-semibold">{summary.down.toLocaleString('en-US')}</span> down
        </span>
        {summary.unknown > 0 ? (
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
            title="Selected but not significant at these thresholds, or not present in this comparison's plotted points"
          >
            {summary.unknown.toLocaleString('en-US')} without a verdict here
          </span>
        ) : null}
      </div>

      {chipRow('Strongest fold change', byFoldChange)}
      {chipRow('Most significant', byPadj)}

      <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex gap-2">
          <input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder={selection.label ?? 'Gene list name'}
            aria-label="Gene list name"
            className="min-w-0 flex-1 px-2 py-1.5 text-xs"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-primary)',
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50"
            style={actionStyle}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListPlus className="h-3.5 w-3.5" />}
            Save list
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleBookmarkAll}
            disabled={bookmarkAll.isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50"
            style={actionStyle}
          >
            {bookmarkAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            Bookmark all
          </button>

          <button
            type="button"
            onClick={() =>
              enrichment.run(selection.genes, selection.label ?? `${comparisonName} selection`)
            }
            disabled={enrichRunning || selection.genes.length === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs disabled:opacity-50"
            style={actionStyle}
          >
            {enrichRunning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {enrichRunning ? 'Enriching…' : 'Enrich these'}
          </button>

          <ExportMenu
            data={exportRows}
            filename={`${comparisonName}_selection`}
            formats={['csv', 'json']}
            csvColumns={['gene', 'log2_fold_change', 'adjusted_p_value', 'regulation']}
            variant="outline"
            size="sm"
          />
        </div>

        {enrichment.error ? (
          <p className="text-xs" style={{ color: 'var(--sl-red)' }}>
            {enrichment.error}
          </p>
        ) : enrichment.result ? (
          <div className="pt-1">
            <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {enrichment.result.length === 0
                ? 'No pathway is enriched in this selection'
                : `Enriched in ${enrichment.result.length.toLocaleString('en-US')} pathway${
                    enrichment.result.length === 1 ? '' : 's'
                  }`}
            </p>
            <ul className="space-y-1">
              {enrichment.result.slice(0, 5).map((row) => (
                <li
                  key={row.pathway_id}
                  className="flex items-baseline justify-between gap-2 text-xs"
                >
                  <span
                    className="truncate"
                    style={{ color: 'var(--text-primary)' }}
                    title={row.pathway_name}
                  >
                    {row.pathway_name}
                  </span>
                  {row.padj !== null ? (
                    <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--sl-purple)' }}>
                      {row.padj.toExponential(1)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {notice ? (
          <p className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--sl-teal-dark)' }}>
            <Check className="h-3.5 w-3.5" />
            {notice}
          </p>
        ) : null}

        <button
          type="button"
          onClick={clearSelection}
          className="block text-xs underline"
          style={{ color: 'var(--sl-teal-dark)' }}
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
