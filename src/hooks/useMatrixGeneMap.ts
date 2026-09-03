'use client';

/**
 * Every gene of an expression matrix, and its symbol when the matrix carries one.
 *
 * Moved out of an effect in `ComparisonDetail` for one concrete reason: it refired on every
 * remount and, on the third strategy, could pull a hundred thousand rows. Under React Query it
 * is fetched once per matrix and shared by whoever needs it, with a long `staleTime` — the gene
 * list of a matrix does not change while someone is reading a comparison.
 *
 * The three strategies are kept in the same order, because they are a compatibility cascade
 * rather than a preference: `/genes/map` exists only on newer backends, `/query` works
 * everywhere but has to build the map row by row to stay aligned, and `/genes/list` is the last
 * resort that yields ids with no symbols at all.
 */

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import type { Dataset } from '@/types';

type Row = Record<string, unknown>;

export interface MatrixGeneMap {
  /** Every gene key of the matrix, in matrix order. */
  genes: string[];
  /** `gene_id -> gene_name`, empty when the matrix has no symbol column. */
  nameByGene: Record<string, string>;
}

const EMPTY: MatrixGeneMap = { genes: [], nameByGene: {} };

export function useMatrixGeneMap(matrixDataset: Dataset | undefined) {
  const datasetId = matrixDataset?.id;

  return useQuery<MatrixGeneMap>({
    queryKey: ['matrix-gene-map', datasetId],
    enabled: !!datasetId,
    // The gene list of a matrix is fixed for the lifetime of the dataset.
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryFn: async () => {
      // Strategy 1 — /genes/map: fast, and alignment-safe because the backend pairs the columns.
      try {
        const response = await api.get(`/datasets/${datasetId}/genes/map`, {
          params: { primary_column: 'gene_id', secondary_column: 'gene_name' },
        });
        const nameByGene: Record<string, string> = response.data?.gene_map ?? {};
        if (Object.keys(nameByGene).length > 0) {
          return { genes: Object.keys(nameByGene), nameByGene };
        }
      } catch {
        // Endpoint absent or columns missing — fall through.
      }

      // Strategy 2 — /query: works on any backend version. Built row by row rather than from
      // two column arrays, so an id can never be paired with the wrong symbol.
      try {
        const response = await api.post(`/datasets/${datasetId}/query`, {
          limit: 100000,
          columns: ['gene_id', 'gene_name'],
        });
        const rows: Row[] = Array.isArray(response.data?.data) ? response.data.data : [];
        const columns: string[] = response.data?.columns ?? [];

        if (columns.includes('gene_id')) {
          const genes: string[] = [];
          const nameByGene: Record<string, string> = {};
          for (const row of rows) {
            const id = row['gene_id'];
            if (!id) continue;
            genes.push(String(id));
            const name = row['gene_name'];
            if (name) nameByGene[String(id)] = String(name);
          }
          return { genes, nameByGene };
        }

        // No gene_id column: this matrix keys on the symbol itself.
        if (columns.includes('gene_name')) {
          const genes = rows
            .map((row) => row['gene_name'])
            .filter(Boolean)
            .map(String);
          return { genes, nameByGene: {} };
        }
      } catch {
        // Query failed — fall through to the last resort.
      }

      // Strategy 3 — ids only, so gene-symbol search is unavailable on this dataset.
      try {
        const response = await api.get(`/datasets/${datasetId}/genes/list`, {
          params: { gene_column: 'gene_id' },
        });
        return { genes: response.data?.genes ?? [], nameByGene: {} };
      } catch (error) {
        console.error('Failed to fetch matrix genes:', error);
        return EMPTY;
      }
    },
  });
}
