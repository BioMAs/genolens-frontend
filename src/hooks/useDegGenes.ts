import { keepPreviousData, useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import type { VolcanoThresholds } from '@/utils/volcano';

/**
 * One page of DEG rows, filtered, sorted and paginated **by the server**.
 *
 * `DEGTable` used to fetch `page_size: 1000` once and then sort, filter and paginate in memory.
 * That silently truncated any comparison with more than a thousand significant genes, reported
 * "Showing X of Y" over the truncated set, and applied the regulation filter *after* the
 * truncation — so filtering to UP could hide UP genes that existed. Every one of `regulation`,
 * `sort_by`, `sort_order`, `page` and `page_size` is a real server parameter and
 * `pagination.total` a real count (`datasets.py:1833-1935`), so doing it server-side is both
 * correct and less code.
 *
 * Unlike the volcano, this genuinely refetches on a threshold change: `padj_max` and `logfc_min`
 * are SQL filters (`datasets.py:1793-1795`). `placeholderData` keeps the previous page on screen
 * while the new one loads, so tightening a threshold does not blank the table.
 */

/** A DEG row exactly as `GET /datasets/{id}/deg-genes/{comparison}` returns it. */
export interface DegGeneRow {
  gene_id: string;
  log_fc: number;
  padj: number;
  regulation: string;
  pvalue: number | null;
  base_mean: number | null;
  gene_name: string | null;
}

/** Columns the server can sort on (`datasets.py:1890-1894`). Anything else falls back to padj. */
export type DegSortField = 'padj' | 'log_fc' | 'gene_id';

export type DegRegulationFilter = 'all' | 'up' | 'down';

/** Largest page the endpoint accepts (`page_size: Query(50, ge=1, le=1000)`). */
export const DEG_MAX_PAGE_SIZE = 1000;

export interface DegGenesQuery {
  regulation?: DegRegulationFilter;
  page?: number;
  pageSize?: number;
  sortBy?: DegSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface DegGenesPage {
  genes: DegGeneRow[];
  /**
   * UP and DOWN counts for the whole comparison, **not** narrowed by the current thresholds:
   * the server counts them with only the dataset and comparison filters applied
   * (`datasets.py:1878-1887`). They are therefore the "at ingestion thresholds" reference, not
   * a live total — derive live counts from the volcano cloud instead.
   */
  totalUp: number;
  totalDown: number;
  pagination: {
    page: number;
    pageSize: number;
    /** Rows matching the current filters, before pagination. The real count. */
    total: number;
    totalPages: number;
  };
}

interface DegGenesApiResponse {
  genes?: DegGeneRow[];
  total_up?: number;
  total_down?: number;
  pagination?: {
    page?: number;
    page_size?: number;
    total?: number;
    total_pages?: number;
  };
}

/** Translate the UI's filter vocabulary into the server's. `all` means "send nothing". */
function regulationParam(filter: DegRegulationFilter | undefined): 'UP' | 'DOWN' | undefined {
  if (filter === 'up') return 'UP';
  if (filter === 'down') return 'DOWN';
  return undefined;
}

function degGenesUrl(datasetId: string, comparisonName: string): string {
  return `/datasets/${datasetId}/deg-genes/${encodeURIComponent(comparisonName)}`;
}

function degGenesParams(
  thresholds: VolcanoThresholds,
  q: {
    page: number;
    pageSize: number;
    sortBy: DegSortField;
    sortOrder: 'asc' | 'desc';
    regulation?: 'UP' | 'DOWN';
  }
) {
  return {
    page: q.page,
    page_size: q.pageSize,
    padj_max: thresholds.padj,
    logfc_min: thresholds.logfc,
    sort_by: q.sortBy,
    sort_order: q.sortOrder,
    ...(q.regulation ? { regulation: q.regulation } : {}),
  };
}

/**
 * Every DEG row of a comparison at the given thresholds, walked page by page.
 *
 * For exports, called at click time: the endpoint caps a page at `DEG_MAX_PAGE_SIZE`, so a single
 * request would silently stop at the thousandth gene. Sorted by padj so the file reads like the
 * table. `deg_genes` only holds genes that were significant at ingestion, so this is every DEG
 * at the current thresholds, not every measured gene.
 */
export async function fetchAllDegGenes(
  datasetId: string,
  comparisonName: string,
  thresholds: VolcanoThresholds
): Promise<DegGeneRow[]> {
  const rows: DegGeneRow[] = [];
  for (let page = 1; ; page += 1) {
    const response = await api.get<DegGenesApiResponse>(degGenesUrl(datasetId, comparisonName), {
      params: degGenesParams(thresholds, {
        page,
        pageSize: DEG_MAX_PAGE_SIZE,
        sortBy: 'padj',
        sortOrder: 'asc',
      }),
    });
    const genes = response.data.genes ?? [];
    rows.push(...genes);
    const totalPages =
      response.data.pagination?.total_pages ??
      Math.ceil((response.data.pagination?.total ?? 0) / DEG_MAX_PAGE_SIZE);
    // Stop on the last page, and on an empty one: a count that drifts while paging must not
    // loop forever.
    if (page >= totalPages || genes.length === 0) return rows;
  }
}

/**
 * The export shape of a DEG row: the columns a reader expects, with the source's names.
 * Numbers stay numbers so JSON consumers need not parse them back.
 */
export function toDegExportRow(row: DegGeneRow) {
  return {
    gene_id: row.gene_id,
    gene_symbol: row.gene_name ?? '',
    log2_fold_change: row.log_fc,
    adjusted_p_value: row.padj,
    regulation: row.regulation,
  };
}

export const DEG_EXPORT_COLUMNS = [
  'gene_id',
  'gene_symbol',
  'log2_fold_change',
  'adjusted_p_value',
  'regulation',
];

export function useDegGenes(
  datasetId: string | undefined,
  comparisonName: string | undefined,
  thresholds: VolcanoThresholds,
  query: DegGenesQuery = {},
  enabled: boolean = true
) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), DEG_MAX_PAGE_SIZE);
  const sortBy: DegSortField = query.sortBy ?? 'padj';
  const sortOrder = query.sortOrder ?? 'asc';
  const regulation = regulationParam(query.regulation);

  return useQuery<DegGenesPage>({
    queryKey: [
      'deg-genes',
      datasetId,
      comparisonName,
      thresholds.padj,
      thresholds.logfc,
      regulation ?? 'ALL',
      page,
      pageSize,
      sortBy,
      sortOrder,
    ],
    queryFn: async () => {
      const response = await api.get<DegGenesApiResponse>(
        degGenesUrl(datasetId as string, comparisonName as string),
        {
          params: degGenesParams(thresholds, { page, pageSize, sortBy, sortOrder, regulation }),
        }
      );

      const data = response.data;
      const total = data.pagination?.total ?? 0;

      return {
        genes: data.genes ?? [],
        totalUp: data.total_up ?? 0,
        totalDown: data.total_down ?? 0,
        pagination: {
          page: data.pagination?.page ?? page,
          pageSize: data.pagination?.page_size ?? pageSize,
          total,
          totalPages: data.pagination?.total_pages ?? Math.ceil(total / pageSize),
        },
      };
    },
    // Keep the current page visible while the next one loads, so a threshold edit or a page turn
    // never flashes an empty table.
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 20,
    enabled: !!datasetId && !!comparisonName && enabled,
    refetchOnWindowFocus: false,
  });
}
