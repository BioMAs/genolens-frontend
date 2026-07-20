'use client';

/**
 * MethodStatsPanel
 *
 * Shows the multi-method differential-expression statistics for a single
 * comparison:
 *   1. A per-method summary (up / down / total DEGs) with the active method
 *      highlighted.
 *   2. A per-gene table listing the p-value and adjusted p-value of every
 *      tested method (Stouffer, DESeq2, edgeR, limma, Fisher, …), Stouffer
 *      first.
 *
 * Data comes from `GET /datasets/{id}/deg-stats?comparison=...`. A CSV export
 * (all methods) is available through the existing `/deg-stats/export` endpoint.
 */

import { Fragment, useMemo, useState } from 'react';
import { Download, ArrowUp, ArrowDown } from 'lucide-react';
import api from '@/utils/api';
import { useDegStats, type DegStatsRow } from '@/hooks/useDegStats';

interface MethodStatsPanelProps {
  datasetId: string;
  comparisonName: string;
}

// Preferred display order; any extra method is appended after these.
const METHOD_ORDER = ['Stouffer', 'DESeq2', 'edgeR', 'limma', 'Fisher'];

const PAGE_SIZE = 25;

function orderMethods(methods: string[]): string[] {
  const known = METHOD_ORDER.filter((m) => methods.includes(m));
  const extra = methods.filter((m) => !METHOD_ORDER.includes(m)).sort();
  return [...known, ...extra];
}

function formatP(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  if (n === 0) return '0';
  if (n < 0.001) return n.toExponential(2);
  return n.toFixed(4);
}

function formatFc(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(2);
}

/** Resolve the dynamic column key for `prefix.Method:comparison` style names. */
function findColumn(keys: string[], prefix: string): string | undefined {
  // Exact `prefix:` (default, no method) or `prefix.<comp>` variants.
  return keys.find((k) => k === prefix || k.startsWith(`${prefix}:`) || k.startsWith(`${prefix}.`));
}

function findMethodColumn(keys: string[], base: 'pvalue' | 'padj', method: string): string | undefined {
  return keys.find((k) => k.startsWith(`${base}.${method}:`) || k === `${base}.${method}`);
}

export default function MethodStatsPanel({ datasetId, comparisonName }: MethodStatsPanelProps) {
  const { data, isLoading, isError, error } = useDegStats(datasetId, comparisonName);

  const [page, setPage] = useState(0);
  const [significantOnly, setSignificantOnly] = useState(false);
  const [sortMethod, setSortMethod] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [downloading, setDownloading] = useState(false);

  const methods = useMemo(() => {
    const available = data?.available_methods?.[comparisonName] ?? [];
    return orderMethods(available);
  }, [data, comparisonName]);

  const activeMethod = useMemo(() => {
    const s = data?.stats?.[comparisonName] as { active_method?: string } | undefined;
    return s?.active_method ?? methods[0];
  }, [data, comparisonName, methods]);

  const general = data?.general?.[comparisonName] ?? {};

  // Build the per-gene column map once we know the row shape.
  const rows = useMemo(() => data?.individual ?? [], [data]);
  const colMap = useMemo(() => {
    if (rows.length === 0) return null;
    const keys = Object.keys(rows[0]);
    const geneIdKey = keys.includes('gene_id') ? 'gene_id' : undefined;
    const geneNameKey = keys.includes('gene_name') ? 'gene_name' : undefined;
    const logfcKey = findColumn(keys, 'log2FoldChange') ?? findColumn(keys, 'logFC');
    const perMethod = methods.map((m) => ({
      method: m,
      pvalueKey: findMethodColumn(keys, 'pvalue', m),
      padjKey: findMethodColumn(keys, 'padj', m),
      sigKey: keys.includes(`is_sig.${m}`) ? `is_sig.${m}` : undefined,
    }));
    return { geneIdKey, geneNameKey, logfcKey, perMethod };
  }, [rows, methods]);

  const filteredSortedRows = useMemo(() => {
    if (!colMap) return [] as DegStatsRow[];
    let out = rows;
    if (significantOnly) {
      const sigKeys = colMap.perMethod.map((p) => p.sigKey).filter(Boolean) as string[];
      if (sigKeys.length > 0) {
        out = out.filter((r) => sigKeys.some((k) => r[k] === true));
      }
    }
    const sortM = sortMethod ?? activeMethod;
    const padjKey = colMap.perMethod.find((p) => p.method === sortM)?.padjKey;
    if (padjKey) {
      out = [...out].sort((a, b) => {
        const av = a[padjKey];
        const bv = b[padjKey];
        const an = av === null || av === undefined || av === '' ? Infinity : Number(av);
        const bn = bv === null || bv === undefined || bv === '' ? Infinity : Number(bv);
        return sortDir === 'asc' ? an - bn : bn - an;
      });
    }
    return out;
  }, [rows, colMap, significantOnly, sortMethod, sortDir, activeMethod]);

  const totalPages = Math.max(1, Math.ceil(filteredSortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filteredSortedRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const handleSort = (method: string) => {
    if (sortMethod === method) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortMethod(method);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await api.get(`/datasets/${datasetId}/deg-stats/export`, {
        params: { comparison: comparisonName },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `deg_stats_${comparisonName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DEG stats download failed', e);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading method statistics…</div>;
  }

  if (isError) {
    return (
      <div className="text-center py-12 text-red-600">
        Failed to load method statistics{error instanceof Error ? `: ${error.message}` : ''}.
      </div>
    );
  }

  if (methods.length <= 1) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
        This comparison was produced with a single statistical method, so there is no multi-method
        breakdown to display. The Stouffer combination and per-method p-values appear here only for
        datasets analysed with several methods (DESeq2, edgeR, limma, …).
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Per-method summary */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Method statistics</h2>
            <p className="text-sm text-gray-600">
              Differentially expressed genes per statistical method. The active method (used across
              the rest of the app) is highlighted.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            onClick={handleDownload}
            disabled={downloading}
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Preparing…' : 'Download all methods (.csv)'}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Method</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Up</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Down</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {methods.map((m) => {
                const c = general[m];
                const isActive = m === activeMethod;
                return (
                  <tr key={m} className={isActive ? 'bg-teal-50' : ''}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {m}
                      {isActive && (
                        <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700">
                          active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-600">{c ? c.up.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-right text-rose-600">{c ? c.down.toLocaleString() : '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">
                      {c ? c.total.toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-gene multi-method table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">Per-gene p-values</h3>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={significantOnly}
              onChange={(e) => {
                setSignificantOnly(e.target.checked);
                setPage(0);
              }}
            />
            Significant in any method
          </label>
        </div>

        {colMap ? (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600 sticky left-0 bg-gray-50">Gene</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-600">log2FC</th>
                    {colMap.perMethod.map((p) => (
                      <th
                        key={p.method}
                        className="px-3 py-2 text-right font-medium text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900"
                        colSpan={2}
                        onClick={() => p.padjKey && handleSort(p.method)}
                        title={p.padjKey ? 'Sort by adjusted p-value' : undefined}
                      >
                        <span className="inline-flex items-center gap-1">
                          {p.method}
                          {(sortMethod ?? activeMethod) === p.method &&
                            (sortDir === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            ))}
                        </span>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="px-3 py-1 sticky left-0 bg-gray-50" />
                    <th className="px-3 py-1" />
                    {colMap.perMethod.map((p) => (
                      <Fragment key={p.method}>
                        <th className="px-3 py-1 text-right font-normal text-gray-400">p</th>
                        <th className="px-3 py-1 text-right font-normal text-gray-400">padj</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.map((row, idx) => {
                    const geneId = colMap.geneIdKey ? String(row[colMap.geneIdKey] ?? '') : '';
                    const geneName = colMap.geneNameKey ? row[colMap.geneNameKey] : undefined;
                    return (
                      <tr key={`${geneId}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium text-gray-900 sticky left-0 bg-white">
                          {geneName ? String(geneName) : geneId}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700">
                          {colMap.logfcKey ? formatFc(row[colMap.logfcKey]) : '—'}
                        </td>
                        {colMap.perMethod.map((p) => (
                          <Fragment key={p.method}>
                            <td className="px-3 py-1.5 text-right text-gray-600">
                              {p.pvalueKey ? formatP(row[p.pvalueKey]) : '—'}
                            </td>
                            <td
                              className={`px-3 py-1.5 text-right ${
                                p.sigKey && row[p.sigKey] === true ? 'font-semibold text-teal-700' : 'text-gray-600'
                              }`}
                            >
                              {p.padjKey ? formatP(row[p.padjKey]) : '—'}
                            </td>
                          </Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
              <span>
                {filteredSortedRows.length.toLocaleString()} genes · page {currentPage + 1} / {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </button>
                <button
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">No gene-level statistics available.</div>
        )}
      </div>
    </div>
  );
}
