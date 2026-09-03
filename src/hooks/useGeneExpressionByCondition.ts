'use client';

/**
 * One gene's expression, grouped by the two conditions of a comparison.
 *
 * Extracted from `GeneExpressionViewer`, which fetched in a callback and kept the result in
 * local state. Under React Query it is cached per `(matrix, gene, samples)`, so clicking around
 * the volcano re-shows a gene already looked at instantly instead of refetching it.
 *
 * Uses `POST /datasets/{id}/query` — the path the viewer proved. Note there is also a
 * `POST /datasets/{id}/gene-expression` behind `useGeneExpression`; they are not the same
 * endpoint, and this is the one with a working caller.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export interface SampleValue {
  sample: string;
  value: number;
}

export interface ConditionExpression {
  name: string;
  samples: SampleValue[];
  values: number[];
}

export interface GeneExpression {
  gene: string;
  groups: ConditionExpression[];
}

type Row = Record<string, unknown>;

/** Column names that hold the gene key rather than a sample's value. */
const GENE_COLUMNS = ['gene_id', 'gene', 'gene_name', 'geneid'];

/**
 * The two condition names a comparison contrasts.
 *
 * `A_vs_B` is the usual shape; the looser separator is kept because names in the wild use it.
 */
export function parseConditions(comparisonName: string): [string, string] {
  const parts = comparisonName.split('_vs_');
  if (parts.length === 2) return [parts[0], parts[1]];
  const alt = comparisonName.split(/[-_\s]vs[-_\s]/i);
  if (alt.length === 2) return [alt[0], alt[1]];
  return [comparisonName, ''];
}

/**
 * Split one matrix row into the comparison's condition groups.
 *
 * Pure, and kept verbatim from the viewer including both fallbacks, which matter:
 *
 * - with no sample→condition metadata, a sample is assigned by whether its *name* contains a
 *   condition string, which is how older datasets were readable at all;
 * - if neither condition matches anything, every sample becomes one unnamed group rather than
 *   the panel rendering empty. Showing the values without a split beats showing nothing.
 */
export function groupByCondition(
  row: Row,
  sampleColumns: string[],
  conditions: [string, string],
  conditionBySample?: Record<string, string>
): ConditionExpression[] {
  const first: SampleValue[] = [];
  const second: SampleValue[] = [];

  const push = (target: SampleValue[], sample: string, value: number) =>
    target.push({ sample, value });

  const hasMetadata = conditionBySample && Object.keys(conditionBySample).length > 0;

  for (const sample of sampleColumns) {
    const value = Number.parseFloat(String(row[sample]));
    if (Number.isNaN(value)) continue;

    if (hasMetadata) {
      const condition = conditionBySample[sample];
      if (condition === conditions[0]) push(first, sample, value);
      else if (condition === conditions[1]) push(second, sample, value);
      continue;
    }

    const name = sample.toLowerCase();
    if (conditions[0] && name.includes(conditions[0].toLowerCase())) push(first, sample, value);
    else if (conditions[1] && name.includes(conditions[1].toLowerCase())) push(second, sample, value);
  }

  if (first.length === 0 && second.length === 0) {
    for (const sample of sampleColumns) {
      const value = Number.parseFloat(String(row[sample]));
      if (!Number.isNaN(value)) push(first, sample, value);
    }
    return [{ name: 'All samples', samples: first, values: first.map((s) => s.value) }];
  }

  const groups: ConditionExpression[] = [];
  if (first.length > 0) {
    groups.push({
      name: conditions[0] || 'All samples',
      samples: first,
      values: first.map((s) => s.value),
    });
  }
  if (second.length > 0) {
    groups.push({
      name: conditions[1] || '',
      samples: second,
      values: second.map((s) => s.value),
    });
  }
  return groups;
}

interface Params {
  matrixDatasetId: string | undefined;
  gene: string | null | undefined;
  comparisonName: string;
  sampleIds?: string[];
  conditionBySample?: Record<string, string>;
}

export function useGeneExpressionByCondition({
  matrixDatasetId,
  gene,
  comparisonName,
  sampleIds,
  conditionBySample,
}: Params) {
  return useQuery<GeneExpression | null>({
    // sampleIds is part of the key: the same gene restricted to different samples is a
    // different answer.
    queryKey: ['gene-expression-by-condition', matrixDatasetId, gene, comparisonName, sampleIds],
    enabled: !!matrixDatasetId && !!gene,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await api.post(`/datasets/${matrixDatasetId}/query`, {
        gene_ids: [gene],
        sample_ids: sampleIds,
        limit: 1,
      });

      const rows: Row[] = Array.isArray(response.data?.data) ? response.data.data : [];
      if (rows.length === 0) return null;

      const columns: string[] = response.data?.columns ?? [];
      const sampleColumns = columns.filter((c) => !GENE_COLUMNS.includes(c.toLowerCase()));

      return {
        gene: gene as string,
        groups: groupByCondition(
          rows[0],
          sampleColumns,
          parseConditions(comparisonName),
          conditionBySample
        ),
      };
    },
  });
}
