'use client';

import { useState } from 'react';
import { Dataset } from '@/types';
import { ChevronUp, ChevronDown, Settings } from 'lucide-react';
import BookmarkButton from './BookmarkButton';
import ExportMenu from './ExportMenu';
import { PValToken } from './ui/pval-token';
import { useThresholds } from '@/contexts/ComparisonSelectionContext';
import {
  DEG_MAX_PAGE_SIZE,
  useDegGenes,
  type DegRegulationFilter,
  type DegSortField,
} from '@/hooks/useDegGenes';
import { getPalette } from '@/utils/chartPalettes';
import { useViewPreferences } from '@/contexts/ComparisonSelectionContext';

interface DEGTableProps {
  dataset: Dataset;
  comparisonName: string;
}

const COLUMN_LABELS = {
  gene_id: 'Gene ID',
  gene_name: 'Gene Symbol',
  log_fc: 'Log2FC',
  padj: 'Padj',
  regulation: 'Regulation',
} as const;

/**
 * Every gene of one comparison, filtered, sorted and paginated by the server.
 *
 * Two bugs fixed relative to the previous version:
 *
 * - It no longer owns thresholds. They come from `ComparisonSelectionContext`, shared with the
 *   volcano above, so the two can no longer describe different populations.
 * - It no longer truncates. It used to fetch `page_size: 1000` once and then sort, filter and
 *   paginate in memory: any comparison with more than a thousand significant genes lost the
 *   remainder silently, "Showing X of Y" counted the truncated set, and the regulation filter
 *   ran *after* the truncation, so filtering to UP could hide UP genes that existed. All of
 *   these are real server parameters (`datasets.py:1833-1935`) and `pagination.total` is a real
 *   count, so the work now happens where the data is.
 */
export default function DEGTable({ dataset, comparisonName }: DEGTableProps) {
  const thresholds = useThresholds();
  const { colorblind } = useViewPreferences();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const [sortField, setSortField] = useState<DegSortField>('padj');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [regulation, setRegulation] = useState<DegRegulationFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    bookmark: true,
    gene_id: true,
    gene_name: true,
    log_fc: true,
    padj: true,
    regulation: true,
  });

  // Anything that changes which rows exist invalidates the current page number. Adjusted during
  // render — React's documented way to reconcile state with changed inputs — rather than in an
  // effect, which would cascade an extra render and trip the project's set-state-in-effect rule.
  const resultsKey = `${thresholds.padj}|${thresholds.logfc}|${regulation}|${pageSize}`;
  const [lastResultsKey, setLastResultsKey] = useState(resultsKey);
  if (lastResultsKey !== resultsKey) {
    setLastResultsKey(resultsKey);
    setPage(1);
  }

  const query = { regulation, page, pageSize, sortBy: sortField, sortOrder };
  const { data, isLoading, isError, isPlaceholderData } = useDegGenes(
    dataset.id,
    comparisonName,
    thresholds,
    query
  );

  // The export has always covered at most one 1000-row page; keeping it on its own query
  // preserves that exactly instead of silently narrowing it to the visible page. Its key omits
  // `page`, so turning pages does not refetch it.
  const { data: exportData } = useDegGenes(dataset.id, comparisonName, thresholds, {
    ...query,
    page: 1,
    pageSize: DEG_MAX_PAGE_SIZE,
  });

  const rows = data?.genes ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 0;
  const firstRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, total);

  const handleSort = (field: DegSortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // padj reads best smallest-first; a fold change and a gene id read best the other way.
      setSortOrder(field === 'padj' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), Math.max(1, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pageNumbers = (): number[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 3) return [1, 2, 3, 4, -1, totalPages];
    if (page >= totalPages - 2) return [1, -1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, -1, page - 1, page, page + 1, -1, totalPages];
  };

  if (isLoading) {
    return (
      <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading DEG table…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
        Failed to load the gene table.
      </div>
    );
  }

  const controlStyle: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-control)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="mt-6" style={{ opacity: isPlaceholderData ? 0.6 : 1 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Regulation filter"
            value={regulation}
            onChange={(e) => setRegulation(e.target.value as DegRegulationFilter)}
            className="px-3 py-2 text-sm"
            style={controlStyle}
          >
            <option value="all">All</option>
            <option value="up">UP</option>
            <option value="down">DOWN</option>
          </select>

          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {total.toLocaleString('en-US')} gene{total === 1 ? '' : 's'} at the current thresholds
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-3 py-2 text-sm"
            style={controlStyle}
          >
            {[25, 50, 100, 200].map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>

          <div className="relative">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="inline-flex items-center px-3 py-2 text-sm"
              style={controlStyle}
            >
              <Settings className="mr-2 h-4 w-4" />
              Columns
            </button>

            {showColumnSelector && (
              <div
                className="absolute right-0 z-10 mt-2 w-64 p-3"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-panel)',
                }}
              >
                <div className="mb-2 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Show/Hide Columns
                </div>
                <div className="space-y-2">
                  {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded p-1">
                      <input
                        type="checkbox"
                        checked={visibleColumns[key as keyof typeof visibleColumns]}
                        onChange={(e) =>
                          setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })
                        }
                      />
                      <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                        {label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <ExportMenu
            data={(exportData?.genes ?? []).map((row) => ({
              gene_id: row.gene_id,
              gene_symbol: row.gene_name || '',
              log2_fold_change: row.log_fc.toFixed(3),
              adjusted_p_value: row.padj.toExponential(2),
              regulation: row.regulation,
            }))}
            filename={`${comparisonName}_DEGs`}
            formats={['csv', 'json']}
            csvColumns={['gene_id', 'gene_symbol', 'log2_fold_change', 'adjusted_p_value', 'regulation']}
            variant="outline"
            size="sm"
          />
        </div>
      </div>

      <div
        className="overflow-x-auto"
        style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-panel)' }}
      >
        <table className="data-table min-w-full">
          <thead>
            <tr>
              {visibleColumns.bookmark && <th aria-label="Bookmark" />}
              {(['gene_id', 'gene_name', 'log_fc', 'padj', 'regulation'] as const)
                .filter((key) => visibleColumns[key])
                .map((key) => {
                  const sortable = key === 'gene_id' || key === 'log_fc' || key === 'padj';
                  if (!sortable) return <th key={key}>{COLUMN_LABELS[key]}</th>;
                  return (
                    <th
                      key={key}
                      className="cursor-pointer"
                      onClick={() => handleSort(key)}
                      aria-sort={
                        sortField === key
                          ? sortOrder === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <span className="flex items-center">
                        {COLUMN_LABELS[key]}
                        {sortField === key &&
                          (sortOrder === 'asc' ? (
                            <ChevronUp className="ml-1 h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="ml-1 h-3.5 w-3.5" />
                          ))}
                      </span>
                    </th>
                  );
                })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center" style={{ color: 'var(--text-muted)' }}>
                  No gene passes these thresholds.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isUp = row.regulation?.toUpperCase() === 'UP';
              return (
                <tr key={row.gene_id}>
                  {visibleColumns.bookmark && (
                    <td className="whitespace-nowrap">
                      <BookmarkButton
                        projectId={dataset.project_id}
                        geneSymbol={row.gene_id}
                        size="sm"
                        variant="icon"
                      />
                    </td>
                  )}
                  {visibleColumns.gene_id && (
                    <td className="whitespace-nowrap font-medium">{row.gene_id}</td>
                  )}
                  {visibleColumns.gene_name && (
                    <td className="whitespace-nowrap">
                      {row.gene_name ? (
                        <span className="gene-symbol">{row.gene_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>–</span>
                      )}
                    </td>
                  )}
                  {visibleColumns.log_fc && (
                    <td className="whitespace-nowrap">
                      <span
                        className="font-mono"
                        style={{ color: row.log_fc > 0 ? palette.up : palette.down }}
                      >
                        {row.log_fc > 0 ? '+' : ''}
                        {row.log_fc.toFixed(2)}
                      </span>
                    </td>
                  )}
                  {visibleColumns.padj && (
                    <td className="whitespace-nowrap">
                      <PValToken value={row.padj.toExponential(2)} />
                    </td>
                  )}
                  {visibleColumns.regulation && (
                    <td className="whitespace-nowrap">
                      <span
                        className="px-2 py-1 text-xs font-semibold"
                        style={{
                          borderRadius: 6,
                          color: isUp ? palette.up : palette.down,
                          background: `color-mix(in srgb, ${isUp ? palette.up : palette.down} 14%, transparent)`,
                        }}
                      >
                        {isUp ? '↑ Up' : '↓ Down'}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Showing {firstRow.toLocaleString('en-US')} to {lastRow.toLocaleString('en-US')} of{' '}
            {total.toLocaleString('en-US')} genes
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={controlStyle}
            >
              Previous
            </button>

            {pageNumbers().map((entry, idx) =>
              entry === -1 ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-3 py-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  …
                </span>
              ) : (
                <button
                  key={entry}
                  onClick={() => goToPage(entry)}
                  aria-current={page === entry ? 'page' : undefined}
                  className="px-3 py-1 text-sm"
                  style={
                    page === entry
                      ? {
                          background: 'var(--sl-teal)',
                          border: '1px solid var(--sl-teal)',
                          borderRadius: 'var(--radius-control)',
                          color: '#fff',
                        }
                      : controlStyle
                  }
                >
                  {entry}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={controlStyle}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
