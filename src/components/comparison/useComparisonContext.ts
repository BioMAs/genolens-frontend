'use client';

/**
 * Everything a comparison screen needs to know about its data, resolved once.
 *
 * Extracted from `ComparisonDetail`, which held all of this in hand-rolled effects and then
 * prop-drilled it. Four of those states were already available as React Query hooks or could
 * be, so they are now: `project` and `datasets` are drop-ins, and the samples and the matrix
 * gene map moved to hooks of their own. Pulling `datasets` from `useProjectDatasets` also
 * **deduplicates a fetch** that happened twice per page, since `ComparisonSidebarNav` already
 * called it.
 *
 * The resolution chain below is moved **verbatim**. It is not obvious code and it is not
 * supposed to be improved here: the scoping to `analysisId` records a real bug fix (comparisons
 * from other analyses sharing a name used to bleed in), and every `find` prefers a READY
 * dataset so that a failed or superseded duplicate is never picked. Changing the *source* of
 * `datasets` is the whole point of this extraction; changing the rules is not.
 *
 * Deliberately still in `ComparisonDetail`: the DEG statistics, whose effect also `api.patch`es
 * dataset metadata back — a write on read that has to become an explicit mutation before it
 * moves anywhere — and the reprocess poll loop.
 */

import { useMemo } from 'react';
import { Dataset, DatasetStatus, DatasetType, Project } from '@/types';
import { useProject, useProjectDatasets } from '@/hooks/useProjectData';
import { useComparisonSamples, type ComparisonSamples } from '@/hooks/useComparisonSamples';
import { useMatrixGeneMap, type MatrixGeneMap } from '@/hooks/useMatrixGeneMap';

export interface ComparisonContext {
  project: Project | undefined;
  datasets: Dataset[];
  /** The comparison name as the URL spells it, decoded. */
  decodedName: string;
  /**
   * The stored comparison key, which can differ from the URL when the URL carries a dataset
   * display name ("DEG Analysis — KO vs WT") rather than the key ("KO_vs_WT").
   */
  actualComparisonName: string;
  degDataset: Dataset | undefined;
  enrichmentDataset: Dataset | undefined;
  matrixDataset: Dataset | undefined;
  samples: ComparisonSamples;
  geneMap: MatrixGeneMap;
  isLoading: boolean;
  isError: boolean;
}

interface Params {
  projectId: string;
  comparisonName: string;
  analysisId?: string;
  /** `?datasetId=` — pins the DEG dataset explicitly, bypassing the name matching. */
  globalDatasetId?: string | null;
}

export function useComparisonContext({
  projectId,
  comparisonName,
  analysisId,
  globalDatasetId,
}: Params): ComparisonContext {
  const projectQuery = useProject(projectId);
  const datasetsQuery = useProjectDatasets(projectId);
  // Memoised, not `?? []` inline: a fresh empty array each render would re-run the whole
  // resolution chain below, and a new `degDataset` identity would ripple into every consumer.
  const datasets = useMemo(() => datasetsQuery.data ?? [], [datasetsQuery.data]);

  const decodedName = useMemo(() => decodeURIComponent(comparisonName), [comparisonName]);

  // Scope candidate datasets to the current analysis (when known) so comparisons
  // from OTHER analyses sharing the same name don't bleed in ("mélange entre
  // analyses"). Falls back to the full project list if the analysis has none.
  const scopedDatasets = useMemo(() => {
    if (!datasets || datasets.length === 0) return [];
    if (analysisId) {
      const inAnalysis = datasets.filter((d) => d.dataset_metadata?.analysis_id === analysisId);
      if (inAnalysis.length > 0) return inAnalysis;
    }
    return datasets;
  }, [datasets, analysisId]);

  const degDataset = useMemo(() => {
    if (globalDatasetId) {
      return datasets.find((d) => d.id === globalDatasetId);
    }
    if (scopedDatasets.length === 0) return undefined;
    const matches = scopedDatasets.filter(
      (d) =>
        d.type === DatasetType.DEG &&
        (d.dataset_metadata?.comparison_name === decodedName ||
          d.name === decodedName ||
          (Array.isArray(d.dataset_metadata?.comparisons) &&
            (d.dataset_metadata.comparisons as unknown[]).includes(decodedName)) ||
          (d.dataset_metadata?.comparisons &&
            typeof d.dataset_metadata.comparisons === 'object' &&
            !Array.isArray(d.dataset_metadata.comparisons) &&
            decodedName in (d.dataset_metadata.comparisons as object)))
    );
    // Prefer a READY dataset so failed/old duplicates are never picked.
    return matches.find((d) => d.status === DatasetStatus.READY) ?? matches[0];
  }, [scopedDatasets, datasets, globalDatasetId, decodedName]);

  const actualComparisonName = useMemo(() => {
    if (!degDataset) return decodedName;
    const meta = degDataset.dataset_metadata;
    if (meta?.comparison_name) return meta.comparison_name;
    if (Array.isArray(meta?.comparisons) && meta.comparisons.length > 0) return meta.comparisons[0];
    return decodedName;
  }, [degDataset, decodedName]);

  const enrichmentDataset = useMemo(() => {
    if (scopedDatasets.length === 0) return undefined;

    const byName = scopedDatasets.filter(
      (d) =>
        d.type === DatasetType.ENRICHMENT &&
        (d.dataset_metadata?.comparison_name === actualComparisonName ||
          d.dataset_metadata?.comparison_name === decodedName ||
          d.name === decodedName)
    );

    // Also match enrichment files via enrichment_comparisons metadata
    const byComparisons = scopedDatasets.filter(
      (d) =>
        d.type === DatasetType.ENRICHMENT &&
        Array.isArray(d.dataset_metadata?.enrichment_comparisons) &&
        ((d.dataset_metadata.enrichment_comparisons as unknown[]).includes(actualComparisonName) ||
          (d.dataset_metadata.enrichment_comparisons as unknown[]).includes(decodedName))
    );

    const matches = byName.length > 0 ? byName : byComparisons;
    // Prefer a READY dataset so failed/old duplicates are never picked.
    return matches.find((d) => d.status === DatasetStatus.READY) ?? matches[0];
  }, [scopedDatasets, decodedName, actualComparisonName]);

  const matrixDataset = useMemo(() => {
    if (!datasets || datasets.length === 0) return undefined;
    return datasets.find((d) => d.type === DatasetType.MATRIX && d.status === DatasetStatus.READY);
  }, [datasets]);

  const samplesQuery = useComparisonSamples(datasets, comparisonName);
  const geneMapQuery = useMatrixGeneMap(matrixDataset);

  return {
    project: projectQuery.data,
    datasets,
    decodedName,
    actualComparisonName,
    degDataset,
    enrichmentDataset,
    matrixDataset,
    samples: samplesQuery.data,
    geneMap: geneMapQuery.data ?? { genes: [], nameByGene: {} },
    // Only the project and its datasets gate the screen. The samples and the gene map feed
    // individual panels, which show their own loading state — blocking the whole comparison on
    // them would be a regression from the effects this replaces, which never did.
    isLoading: projectQuery.isLoading || datasetsQuery.isLoading,
    isError: projectQuery.isError || datasetsQuery.isError,
  };
}
