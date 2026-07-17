import { Dataset, DatasetType } from '@/types';
import type { ComparisonRef } from '@/components/MultiComparisonVenn';

interface ComparisonMetaShape {
  deg_total?: number;
  deg_up?: number;
  deg_down?: number;
}

/**
 * Flatten every comparison across all DEG datasets in a project into a single
 * list of refs (one entry per comparison, tagged with its owning dataset).
 * Supports a single "global" multi-comparison dataset and several
 * single-comparison datasets. Labels are made unique so callers can key by them.
 *
 * Shared by the multi-comparison (Venn) and contrast-scatter pages.
 */
export function buildComparisonRefs(datasets: Dataset[]): ComparisonRef[] {
  const degDatasets = datasets.filter((d) => d.type === DatasetType.DEG);
  const refs: ComparisonRef[] = [];

  const degCountOf = (meta: ComparisonMetaShape | undefined): number => {
    if (!meta) return 0;
    if (typeof meta.deg_total === 'number') return meta.deg_total;
    return (meta.deg_up || 0) + (meta.deg_down || 0);
  };

  const add = (datasetId: string, comparisonName: string, degCount: number) => {
    refs.push({
      // datasetId::comparisonName is unique: a dataset can't hold two
      // comparisons with the same name. Used as the selection id.
      key: `${datasetId}::${comparisonName}`,
      datasetId,
      comparisonName,
      label: comparisonName,
      degCount,
    });
  };

  for (const d of degDatasets) {
    const metadata = (d.dataset_metadata || {}) as Record<string, unknown>;
    const columnsInfo = metadata.columns_info as Record<string, unknown> | undefined;
    const rawComparisons = metadata.comparisons ?? columnsInfo?.comparisons;

    if (Array.isArray(rawComparisons) && rawComparisons.length > 0) {
      // Legacy single-comparison datasets store comparisons as a list of names
      for (const entry of rawComparisons) {
        const comparisonName =
          typeof entry === 'string' ? entry : ((entry as { name?: string })?.name ?? d.name);
        add(d.id, comparisonName, degCountOf(metadata as ComparisonMetaShape));
      }
    } else if (
      rawComparisons &&
      typeof rawComparisons === 'object' &&
      Object.keys(rawComparisons).length > 0
    ) {
      // "Global" dataset: comparisons is a dict keyed by comparison name
      const comparisonsMap = rawComparisons as Record<string, ComparisonMetaShape>;
      for (const [name, meta] of Object.entries(comparisonsMap)) {
        add(d.id, name, degCountOf(meta));
      }
    } else {
      // Fallback: explicit comparison_name, else dataset name
      add(d.id, (metadata.comparison_name as string) || d.name, degCountOf(metadata as ComparisonMetaShape));
    }
  }

  // Make `label` unique. When a comparison name is shared across datasets,
  // prefix with the dataset name; if that still collides, append a numeric suffix.
  const datasetName = new Map(degDatasets.map((d) => [d.id, d.name]));
  const nameCounts = new Map<string, number>();
  for (const r of refs) nameCounts.set(r.comparisonName, (nameCounts.get(r.comparisonName) || 0) + 1);
  for (const r of refs) {
    if ((nameCounts.get(r.comparisonName) || 0) > 1) {
      const dn = datasetName.get(r.datasetId) ?? r.datasetId;
      if (dn && dn !== r.comparisonName) r.label = `${dn}: ${r.comparisonName}`;
    }
  }
  const seen = new Map<string, number>();
  for (const r of refs) {
    const n = (seen.get(r.label) || 0) + 1;
    seen.set(r.label, n);
    if (n > 1) r.label = `${r.label} (${n})`;
  }

  return refs;
}
