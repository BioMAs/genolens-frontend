'use client';

import { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  ZAxis,
} from 'recharts';
import { Download, GitCompareArrows } from 'lucide-react';
import type { ComparisonRef } from '@/components/MultiComparisonVenn';
import { useContrastScatter, type Quadrant, type ScatterPoint } from '@/hooks/useContrastScatter';

interface ContrastScatterProps {
  pathDatasetId: string;
  comparisons: ComparisonRef[];
}

const QUADRANT_META: Record<Quadrant, { label: string; color: string }> = {
  concordant: { label: 'Concordant', color: '#2563eb' },
  discordant: { label: 'Discordant', color: '#dc2626' },
  specific_a: { label: 'Specific to A', color: '#059669' },
  specific_b: { label: 'Specific to B', color: '#d97706' },
  ns: { label: 'Not significant', color: '#cbd5e1' },
};

// Cap the number of rendered points for SVG performance. Interesting points
// (discordant / specific) are always kept; the concordant + NS bulk is sampled.
const MAX_RENDER = 5000;

function fmt(n: number | null | undefined, digits = 3): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n !== 0 && Math.abs(n) < 1e-3) return n.toExponential(2);
  return n.toFixed(digits);
}

export default function ContrastScatter({ pathDatasetId, comparisons }: ContrastScatterProps) {
  const [keyA, setKeyA] = useState<string>(comparisons[0]?.key ?? '');
  const [keyB, setKeyB] = useState<string>(comparisons[1]?.key ?? '');
  const [padjThreshold, setPadjThreshold] = useState(0.05);
  const [logfcThreshold, setLogfcThreshold] = useState(0.58);

  const { loading, result, error, run } = useContrastScatter(pathDatasetId);

  const refByKey = useMemo(
    () => new Map(comparisons.map((c) => [c.key, c])),
    [comparisons]
  );

  const handleRun = () => {
    const a = refByKey.get(keyA);
    const b = refByKey.get(keyB);
    if (!a || !b) return;
    run(
      { dataset_id: a.datasetId, comparison_name: a.comparisonName, label: a.label },
      { dataset_id: b.datasetId, comparison_name: b.comparisonName, label: b.label },
      { padjThreshold, logfcThreshold }
    );
  };

  // Group points by quadrant, downsampling the bulk for rendering.
  const seriesByQuadrant = useMemo(() => {
    if (!result) return null;
    const groups: Record<Quadrant, ScatterPoint[]> = {
      concordant: [], discordant: [], specific_a: [], specific_b: [], ns: [],
    };
    for (const p of result.points) groups[p.quadrant].push(p);

    // Always keep discordant + specific; sample concordant + ns to fit MAX_RENDER.
    const keepAll = [...groups.discordant, ...groups.specific_a, ...groups.specific_b];
    const bulk = [...groups.concordant, ...groups.ns];
    const budget = Math.max(0, MAX_RENDER - keepAll.length);
    let sampledBulk = bulk;
    let downsampled = false;
    if (bulk.length > budget && budget > 0) {
      const step = Math.ceil(bulk.length / budget);
      sampledBulk = bulk.filter((_, i) => i % step === 0);
      downsampled = true;
    }
    const kept = new Set([...keepAll, ...sampledBulk]);
    const rendered: Record<Quadrant, ScatterPoint[]> = {
      concordant: [], discordant: [], specific_a: [], specific_b: [], ns: [],
    };
    for (const q of Object.keys(groups) as Quadrant[]) {
      rendered[q] = groups[q].filter((p) => kept.has(p));
    }
    return { rendered, downsampled };
  }, [result]);

  const axisDomain = useMemo(() => {
    if (!result) return undefined;
    let max = 1;
    for (const p of result.points) {
      max = Math.max(max, Math.abs(p.logfc_a), Math.abs(p.logfc_b));
    }
    const bound = Math.ceil(max);
    return [-bound, bound] as [number, number];
  }, [result]);

  // Discordant + specific genes, sorted by combined significance, for the table.
  const notableGenes = useMemo(() => {
    if (!result) return [];
    return result.points
      .filter((p) => p.quadrant === 'discordant' || p.quadrant === 'specific_a' || p.quadrant === 'specific_b')
      .sort((x, y) => {
        const sx = (x.padj_a ?? 1) + (x.padj_b ?? 1);
        const sy = (y.padj_a ?? 1) + (y.padj_b ?? 1);
        return sx - sy;
      });
  }, [result]);

  const exportCSV = () => {
    if (!result) return;
    const header = ['gene', 'gene_id', 'logfc_a', 'logfc_b', 'padj_a', 'padj_b', 'quadrant'];
    const rows = result.points.map((p) =>
      [p.gene, p.gene_id, p.logfc_a, p.logfc_b, p.padj_a ?? '', p.padj_b ?? '', p.quadrant].join(',')
    );
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contrast_scatter_${result.comparison_a.label}_vs_${result.comparison_b.label}.csv`
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    link.click();
    URL.revokeObjectURL(url);
  };

  const sameSelection = keyA === keyB;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <GitCompareArrows className="h-5 w-5 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Contrast comparison (log2FC vs log2FC)</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Compare two contrasts gene-by-gene. Genes are classified as concordant, discordant, or
          specific to one contrast based on your significance thresholds.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrast A (x-axis)</label>
            <select
              value={keyA}
              onChange={(e) => setKeyA(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {comparisons.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrast B (y-axis)</label>
            <select
              value={keyB}
              onChange={(e) => setKeyB(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {comparisons.map((c) => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">P-adj threshold</label>
            <input
              type="number" min="0" max="1" step="0.01"
              value={padjThreshold}
              onChange={(e) => setPadjThreshold(parseFloat(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">|Log2FC| threshold</label>
            <input
              type="number" min="0" max="10" step="0.1"
              value={logfcThreshold}
              onChange={(e) => setLogfcThreshold(parseFloat(e.target.value))}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={handleRun}
              disabled={loading || sameSelection || !keyA || !keyB}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {loading ? 'Computing…' : 'Compare contrasts'}
            </button>
          </div>
        </div>
        {sameSelection && (
          <p className="mt-2 text-xs text-amber-600">Choose two different contrasts.</p>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && seriesByQuadrant && (
        <>
          {/* Correlation + counts */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{fmt(result.correlation.pearson_r)}</div>
                <div className="text-xs text-gray-600">Pearson r (n={result.correlation.n})</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{fmt(result.correlation.spearman_r)}</div>
                <div className="text-xs text-gray-600">Spearman ρ</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{result.counts.concordant}</div>
                <div className="text-xs text-gray-600">Concordant</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result.counts.discordant}</div>
                <div className="text-xs text-gray-600">Discordant</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
              <span>Shared genes: <strong>{result.counts.shared}</strong></span>
              <span>Specific to A: <strong>{result.counts.specific_a}</strong></span>
              <span>Specific to B: <strong>{result.counts.specific_b}</strong></span>
              <span>Only in A (not tested in B): <strong>{result.counts.only_a}</strong></span>
              <span>Only in B (not tested in A): <strong>{result.counts.only_b}</strong></span>
            </div>
          </div>

          {/* Scatter */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900">log2FC scatter</h3>
              <button
                onClick={exportCSV}
                className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
              >
                <Download className="h-4 w-4" /> Export all genes (.csv)
              </button>
            </div>
            {seriesByQuadrant.downsampled && (
              <p className="text-xs text-amber-600 mb-2">
                Plot downsampled to ~{MAX_RENDER.toLocaleString()} points for performance (all
                discordant/specific genes shown; CSV export contains every gene).
              </p>
            )}
            <ResponsiveContainer width="100%" height={480}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis
                  type="number" dataKey="logfc_a" domain={axisDomain} allowDataOverflow
                  tick={{ fontSize: 12 }}
                  label={{ value: `log2FC — ${result.comparison_a.label}`, position: 'bottom', offset: 10, fontSize: 12 }}
                />
                <YAxis
                  type="number" dataKey="logfc_b" domain={axisDomain} allowDataOverflow
                  tick={{ fontSize: 12 }}
                  label={{ value: `log2FC — ${result.comparison_b.label}`, angle: -90, position: 'left', offset: -5, fontSize: 12 }}
                />
                <ZAxis range={[16, 16]} />
                <ReferenceLine x={0} stroke="#94a3b8" />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <ReferenceLine
                  segment={axisDomain ? [{ x: axisDomain[0], y: axisDomain[0] }, { x: axisDomain[1], y: axisDomain[1] }] : undefined}
                  stroke="#cbd5e1" strokeDasharray="4 4"
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0].payload as ScatterPoint;
                    return (
                      <div className="bg-white border border-gray-200 rounded shadow px-3 py-2 text-xs">
                        <div className="font-semibold text-gray-900">{p.gene}</div>
                        <div>{result.comparison_a.label}: log2FC {fmt(p.logfc_a, 2)}, padj {fmt(p.padj_a)}</div>
                        <div>{result.comparison_b.label}: log2FC {fmt(p.logfc_b, 2)}, padj {fmt(p.padj_b)}</div>
                        <div className="mt-1" style={{ color: QUADRANT_META[p.quadrant].color }}>
                          {QUADRANT_META[p.quadrant].label}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend verticalAlign="top" height={30} />
                {(Object.keys(QUADRANT_META) as Quadrant[]).map((q) => (
                  <Scatter
                    key={q}
                    name={`${QUADRANT_META[q].label} (${result.counts[q]})`}
                    data={seriesByQuadrant.rendered[q]}
                    fill={QUADRANT_META[q].color}
                    fillOpacity={q === 'ns' || q === 'concordant' ? 0.5 : 0.9}
                    isAnimationActive={false}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Notable genes table */}
          {notableGenes.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Discordant &amp; contrast-specific genes ({notableGenes.length})
              </h3>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="text-left text-gray-600">
                      <th className="px-3 py-2 font-medium">Gene</th>
                      <th className="px-3 py-2 font-medium">log2FC A</th>
                      <th className="px-3 py-2 font-medium">log2FC B</th>
                      <th className="px-3 py-2 font-medium">padj A</th>
                      <th className="px-3 py-2 font-medium">padj B</th>
                      <th className="px-3 py-2 font-medium">Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notableGenes.slice(0, 500).map((p) => (
                      <tr key={p.gene_id} className="border-t border-gray-100">
                        <td className="px-3 py-1.5 font-medium text-gray-900">{p.gene}</td>
                        <td className="px-3 py-1.5">{fmt(p.logfc_a, 2)}</td>
                        <td className="px-3 py-1.5">{fmt(p.logfc_b, 2)}</td>
                        <td className="px-3 py-1.5">{fmt(p.padj_a)}</td>
                        <td className="px-3 py-1.5">{fmt(p.padj_b)}</td>
                        <td className="px-3 py-1.5" style={{ color: QUADRANT_META[p.quadrant].color }}>
                          {QUADRANT_META[p.quadrant].label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {notableGenes.length > 500 && (
                <p className="mt-2 text-xs text-gray-500">
                  Showing top 500 by significance. Export CSV for the full list.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
