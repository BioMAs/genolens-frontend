/**
 * MultipleTestingPanel
 *
 * Compares multiple testing correction methods (BH, Bonferroni, Holm, BY)
 * applied to raw p-values of a DEG comparison.
 *
 * Data is fetched from GET /datasets/:id/multiple-testing/:comparison
 */
'use client';

import { useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Info, RefreshCw, Download, ChevronDown, ChevronUp } from 'lucide-react';
import api from '@/utils/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface CorrectionSummaryEntry {
  n_significant: number;
  label: string;
  description: string;
}

interface CorrectionSummary {
  original: CorrectionSummaryEntry;
  bh?: CorrectionSummaryEntry;
  bonferroni?: CorrectionSummaryEntry;
  holm?: CorrectionSummaryEntry;
  by?: CorrectionSummaryEntry;
}

interface GeneResult {
  gene_id: string;
  pvalue: number | null;
  original_padj: number | null;
  padj_bh?: number | null;
  padj_bonferroni?: number | null;
  padj_holm?: number | null;
  padj_by?: number | null;
}

interface MultipleTestingResult {
  dataset_id: string;
  comparison_name: string;
  n_total: number;
  n_tested: number;
  threshold: number;
  summary: CorrectionSummary;
  methods_applied: string[];
  gene_results?: GeneResult[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  original: '#6366f1',
  bh: '#22c55e',
  bonferroni: '#ef4444',
  holm: '#f59e0b',
  by: '#8b5cf6',
};

const METHOD_LABELS: Record<string, string> = {
  original: 'Original',
  bh: 'BH (FDR)',
  bonferroni: 'Bonferroni',
  holm: 'Holm',
  by: 'BY (FDR)',
};

// ── Tooltip for bar chart ────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: { value: number; name: string; payload: { method: string; description: string } }[];
}

function CustomBarTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-lg max-w-xs">
      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{d.name}</p>
      <p className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{d.value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
        {d.payload.description}
      </p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface MultipleTestingPanelProps {
  datasetId: string;
  comparisonName: string;
}

export default function MultipleTestingPanel({
  datasetId,
  comparisonName,
}: MultipleTestingPanelProps) {
  const [threshold, setThreshold] = useState(0.05);
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(
    new Set(['bh', 'bonferroni', 'holm', 'by'])
  );
  const [result, setResult] = useState<MultipleTestingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGenes, setShowGenes] = useState(false);
  const [geneResults, setGeneResults] = useState<GeneResult[]>([]);
  const [loadingGenes, setLoadingGenes] = useState(false);

  // ── Fetch summary ──────────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const methods = Array.from(selectedMethods).join(',');
      const response = await api.get<MultipleTestingResult>(
        `/datasets/${datasetId}/multiple-testing/${encodeURIComponent(comparisonName)}`,
        { params: { methods, threshold, include_genes: false } }
      );
      setResult(response.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [datasetId, comparisonName, selectedMethods, threshold]);

  // ── Fetch per-gene results ─────────────────────────────────────────────────
  const fetchGenes = async () => {
    if (geneResults.length > 0) {
      setShowGenes((v) => !v);
      return;
    }
    setLoadingGenes(true);
    try {
      const methods = Array.from(selectedMethods).join(',');
      const response = await api.get<MultipleTestingResult>(
        `/datasets/${datasetId}/multiple-testing/${encodeURIComponent(comparisonName)}`,
        { params: { methods, threshold, include_genes: true } }
      );
      setGeneResults(response.data.gene_results ?? []);
      setShowGenes(true);
    } catch {
      setShowGenes(false);
    } finally {
      setLoadingGenes(false);
    }
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!geneResults.length) return;
    const methods = Array.from(selectedMethods);
    const headers = ['gene_id', 'pvalue', 'original_padj', ...methods.map((m) => `padj_${m}`)];
    const rows = geneResults.map((g) =>
      [
        g.gene_id,
        g.pvalue ?? '',
        g.original_padj ?? '',
        ...methods.map((m) => (g[`padj_${m}` as keyof GeneResult] as number | null) ?? ''),
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `multiple_testing_${comparisonName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Toggle method ──────────────────────────────────────────────────────────
  const toggleMethod = (method: string) => {
    setSelectedMethods((prev) => {
      const next = new Set(prev);
      if (next.has(method)) {
        if (next.size > 1) next.delete(method); // Keep at least one
      } else {
        next.add(method);
      }
      return next;
    });
    setResult(null);
    setGeneResults([]);
  };

  // ── Bar chart data ─────────────────────────────────────────────────────────
  const chartData = result
    ? (['original', ...Array.from(selectedMethods)] as const)
        .filter((key) => result.summary[key as keyof CorrectionSummary])
        .map((key) => {
          const entry = result.summary[key as keyof CorrectionSummary]!;
          return {
            method: key,
            name: METHOD_LABELS[key] ?? key,
            value: entry.n_significant,
            description: entry.description,
          };
        })
    : [];

  const maxSig = chartData.length ? Math.max(...chartData.map((d) => d.value)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Correction pour tests multiples
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Compare les méthodes de correction appliquées aux p-values brutes de{' '}
            <span className="font-mono font-medium">{comparisonName}</span>.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
        {/* Methods selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Méthodes à comparer
          </label>
          <div className="flex flex-wrap gap-2">
            {(['bh', 'bonferroni', 'holm', 'by'] as const).map((m) => (
              <button
                key={m}
                onClick={() => toggleMethod(m)}
                style={{
                  borderColor: selectedMethods.has(m) ? METHOD_COLORS[m] : undefined,
                  backgroundColor: selectedMethods.has(m) ? `${METHOD_COLORS[m]}18` : undefined,
                  color: selectedMethods.has(m) ? METHOD_COLORS[m] : undefined,
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${
                  selectedMethods.has(m)
                    ? 'border-current'
                    : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                }`}
              >
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seuil de significativité :{' '}
            <span className="font-mono font-bold text-indigo-600">{threshold}</span>
          </label>
          <input
            type="range"
            min={0.001}
            max={0.2}
            step={0.001}
            value={threshold}
            onChange={(e) => {
              setThreshold(Number(e.target.value));
              setResult(null);
              setGeneResults([]);
            }}
            className="w-full max-w-xs accent-indigo-600"
          />
          <div className="flex gap-2 mt-1">
            {[0.001, 0.01, 0.05, 0.1].map((v) => (
              <button
                key={v}
                onClick={() => {
                  setThreshold(v);
                  setResult(null);
                  setGeneResults([]);
                }}
                className={`text-xs px-2 py-1 rounded ${
                  threshold === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Run button */}
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Calcul en cours…' : 'Calculer'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Meta info */}
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong className="text-gray-800 dark:text-gray-200">{result.n_tested.toLocaleString()}</strong> gènes
              avec une p-value valide sur{' '}
              <strong className="text-gray-800 dark:text-gray-200">{result.n_total.toLocaleString()}</strong> total —
              Seuil : <strong className="text-indigo-600">{result.threshold}</strong>
            </span>
          </div>

          {/* Bar chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
              Nombre de gènes significatifs par méthode (seuil {result.threshold})
            </h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-100 dark:stroke-gray-700" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="text-gray-600 dark:text-gray-400"
                  domain={[0, Math.ceil(maxSig * 1.15) || 10]}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.method} fill={METHOD_COLORS[entry.method] ?? '#6366f1'} />
                  ))}
                </Bar>
                <ReferenceLine
                  y={result.summary.original.n_significant}
                  stroke={METHOD_COLORS.original}
                  strokeDasharray="6 3"
                  label={{ value: 'Original', position: 'insideTopRight', fontSize: 10, fill: METHOD_COLORS.original }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Méthode</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Gènes sig. (p &lt; {result.threshold})
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    % du total testé
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {(['original', ...Array.from(selectedMethods)] as const)
                  .filter((k) => result.summary[k as keyof CorrectionSummary])
                  .map((key) => {
                    const entry = result.summary[key as keyof CorrectionSummary]!;
                    const pct =
                      result.n_tested > 0
                        ? ((entry.n_significant / result.n_tested) * 100).toFixed(1)
                        : '0.0';
                    const isOriginal = key === 'original';
                    const type =
                      key === 'bonferroni' || key === 'holm'
                        ? 'FWER'
                        : 'FDR';
                    return (
                      <tr
                        key={key}
                        className={isOriginal ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: METHOD_COLORS[key] ?? '#9ca3af' }}
                            />
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {entry.label}
                            </span>
                            {isOriginal && (
                              <span className="text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                référence
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                          {entry.n_significant.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                          {pct}%
                        </td>
                        <td className="px-4 py-3">
                          {!isOriginal && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded font-medium ${
                                type === 'FDR'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              }`}
                            >
                              {type}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                          {entry.description}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Method explanation card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p className="font-semibold">💡 Quelle méthode choisir ?</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs leading-relaxed">
              <li><strong>BH (Benjamini-Hochberg)</strong> — Standard en génomique. Contrôle le FDR, moins conservatrice.</li>
              <li><strong>Holm</strong> — Plus puissante que Bonferroni, contrôle le FWER. Recommandée si vous cherchez une alternative FWER.</li>
              <li><strong>Bonferroni</strong> — La plus conservatrice. Adapté pour un très faible nombre de tests.</li>
              <li><strong>BY</strong> — Comme BH mais valide même sous dépendance arbitraire entre tests.</li>
            </ul>
          </div>

          {/* Per-gene table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Résultats par gène
              </h4>
              <div className="flex items-center gap-2">
                {geneResults.length > 0 && (
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 dark:border-indigo-800 dark:hover:bg-indigo-900/20 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    CSV
                  </button>
                )}
                <button
                  onClick={fetchGenes}
                  disabled={loadingGenes}
                  className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {loadingGenes ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : showGenes ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  {showGenes ? 'Masquer' : `Afficher ${result.n_total.toLocaleString()} gènes`}
                </button>
              </div>
            </div>

            {showGenes && geneResults.length > 0 && (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Gène</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-300">p-value</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600 dark:text-gray-300">Original padj</th>
                      {Array.from(selectedMethods).map((m) => (
                        <th key={m} className="text-right px-3 py-2 font-medium" style={{ color: METHOD_COLORS[m] }}>
                          {METHOD_LABELS[m]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {geneResults.slice(0, 500).map((gene) => (
                      <tr key={gene.gene_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-3 py-1.5 font-mono font-medium text-gray-900 dark:text-white">
                          {gene.gene_id}
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-400 font-mono">
                          {gene.pvalue != null ? gene.pvalue.toExponential(2) : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          <SigValue value={gene.original_padj} threshold={result.threshold} color={METHOD_COLORS.original} />
                        </td>
                        {Array.from(selectedMethods).map((m) => {
                          const val = gene[`padj_${m}` as keyof GeneResult] as number | null;
                          return (
                            <td key={m} className="px-3 py-1.5 text-right font-mono">
                              <SigValue value={val} threshold={result.threshold} color={METHOD_COLORS[m]} />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {geneResults.length > 500 && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                    Affichage limité aux 500 premiers gènes. Utilisez l&#39;export CSV pour la liste complète.
  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-lg mb-2">📊</p>
          <p className="text-sm">Sélectionnez les méthodes et cliquez sur <strong>Calculer</strong></p>
        </div>
      )}
    </div>
  );
}

// ── Helper component ─────────────────────────────────────────────────────────

function SigValue({
  value,
  threshold,
  color,
}: {
  value: number | null;
  threshold: number;
  color: string;
}) {
  if (value == null) return <span className="text-gray-300">—</span>;
  const sig = value < threshold;
  return (
    <span
      className={`${sig ? 'font-semibold' : 'text-gray-500 dark:text-gray-400'}`}
      style={sig ? { color } : undefined}
    >
      {value.toExponential(2)}
      {sig && ' ★'}
    </span>
  );
}
