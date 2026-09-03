'use client';

/**
 * The samples that belong to one comparison, and their conditions.
 *
 * `ComparisonDetail` used to fetch the sample-metadata dataset itself, in an effect, with
 * `limit: 500` — while `useSampleConditionMap` fetched the *same* dataset with `limit: 5000`
 * under its own key. Two fetches of one table, disagreeing on how much of it to read. This
 * builds on the hook instead: one query, one key, and the comparison's samples derived from it.
 *
 * The selection rule is kept verbatim from the effect it replaces, because it encodes a real
 * fallback: a comparison is *usually* named `ConditionA_vs_ConditionB`, but not always, and a
 * name that does not split has to be matched loosely or the heatmap and the signature panel
 * silently lose their samples.
 */

import { useMemo } from 'react';
import { Dataset, DatasetStatus, DatasetType } from '@/types';
import { useSampleConditionMap } from './useSampleConditionMap';

export interface ComparisonSamples {
  /** Samples on either side of this comparison, in metadata order. */
  sampleIds: string[];
  /** `sample -> condition`, narrowed to those samples. */
  conditionMap: Record<string, string>;
  /** The two condition names, when the comparison name yields them. */
  conditions: { left: string; right: string } | null;
}

const EMPTY: ComparisonSamples = { sampleIds: [], conditionMap: {}, conditions: null };

/**
 * Narrow a whole-dataset `sample -> condition` map to one comparison.
 *
 * Pure, so the fallback below can be tested without a fetch.
 */
export function selectComparisonSamples(
  allConditions: Record<string, string> | undefined,
  comparisonName: string
): ComparisonSamples {
  if (!allConditions) return EMPTY;

  const decoded = decodeURIComponent(comparisonName);
  const parts = decoded.split('_vs_');
  const entries = Object.entries(allConditions);

  // The common shape: two named conditions, matched exactly.
  if (parts.length === 2) {
    const [left, right] = parts;
    const kept = entries.filter(([, condition]) => condition === left || condition === right);
    return {
      sampleIds: kept.map(([sample]) => sample),
      conditionMap: Object.fromEntries(kept),
      conditions: { left, right },
    };
  }

  // Anything else: keep a sample whose condition appears in the name at all. Loose on purpose —
  // dropping to zero samples would silently empty the heatmap and the signature panel.
  const kept = entries.filter(([, condition]) => condition && decoded.includes(condition));
  return {
    sampleIds: kept.map(([sample]) => sample),
    conditionMap: Object.fromEntries(kept),
    conditions: null,
  };
}

/** The sample-metadata dataset of a project, if it has a usable one. */
export function findMetadataDataset(datasets: Dataset[] | undefined): Dataset | undefined {
  return datasets?.find(
    (d) => d.type === DatasetType.METADATA_SAMPLE && d.status === DatasetStatus.READY
  );
}

export function useComparisonSamples(datasets: Dataset[] | undefined, comparisonName: string) {
  const metadataDataset = useMemo(() => findMetadataDataset(datasets), [datasets]);
  const query = useSampleConditionMap(metadataDataset);

  const data = useMemo(
    () => selectComparisonSamples(query.data, comparisonName),
    [query.data, comparisonName]
  );

  return { ...query, data };
}
