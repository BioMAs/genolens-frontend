'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Download, ArrowLeft, ArrowRight, GitBranch } from 'lucide-react';
import { useDegPatterns, type PatternCluster, type DegSource } from '@/hooks/useDegPatterns';
import { getPalette } from '@/utils/chartPalettes';

interface DEGPatternsViewProps {
  matrixDatasetId: string;
  degSources: DegSource[];
  sampleConditionMap?: Record<string, string>;
  label?: string;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

// Per-group q25/median/q75 band data for one cluster's small-multiple chart.
function facetData(cluster: PatternCluster, groups: string[]) {
  return groups.map((g, gi) => {
    const vals = cluster.gene_trajectories.map((t) => t.values[gi]).filter((v) => Number.isFinite(v));
    const sorted = [...vals].sort((a, b) => a - b);
    return {
      group: g,
      band: [quantile(sorted, 0.25), quantile(sorted, 0.75)] as [number, number],
      median: cluster.median[gi],
    };
  });
}

export default function DEGPatternsView({
  matrixDatasetId,
  degSources,
  sampleConditionMap,
  label = 'this analysis',
}: DEGPatternsViewProps) {
  const { loading, result, error, run } = useDegPatterns(matrixDatasetId);

  const [nClusters, setNClusters] = useState(6);
  const [minClusterSize, setMinClusterSize] = useState(15);
  const [groupOrder, setGroupOrder] = useState<string[] | null>(null);

  const doRun = (order?: string[]) =>
    run({
      degSources,
      sampleConditionMap,
      groupOrder: order,
      nClusters,
      minClusterSize,
    });

  // Sync the editable group order from the first result
  useEffect(() => {
    if (result && groupOrder === null) setGroupOrder(result.groups);
  }, [result, groupOrder]);

  const palette = getPalette('standard').categorical;

  const moveGroup = (idx: number, dir: -1 | 1) => {
    if (!groupOrder) return;
    const j = idx + dir;
    if (j < 0 || j >= groupOrder.length) return;
    const next = [...groupOrder];
    [next[idx], next[j]] = [next[j], next[idx]];
    setGroupOrder(next);
  };

  const yDomain = useMemo(() => {
    if (!result) return [-2, 2] as [number, number];
    let m = 1;
    for (const c of result.clusters) {
      for (const t of c.gene_trajectories) for (const v of t.values) m = Math.max(m, Math.abs(v));
    }
    const b = Math.min(Math.ceil(m), 4); // clamp for readability
    return [-b, b] as [number, number];
  }, [result]);

  const exportCSV = () => {
    if (!result) return;
    const lines = ['gene,cluster'];
    for (const c of result.clusters) for (const g of c.genes) lines.push(`${g},${c.id}`);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deg_patterns_${label}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="h-5 w-5 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">DEG patterns</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Group the significant DEGs of <strong>{label}</strong> (union across all comparisons) into
          clusters that share an expression trajectory across the analysis&apos; conditions (z-scored).
          Each panel shows a cluster&apos;s median trajectory and its interquartile band.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Number of clusters</label>
            <input
              type="number" min={2} max={20} value={nClusters}
              onChange={(e) => setNClusters(parseInt(e.target.value) || 6)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Min cluster size</label>
            <input
              type="number" min={1} max={500} value={minClusterSize}
              onChange={(e) => setMinClusterSize(parseInt(e.target.value) || 15)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              onClick={() => doRun(groupOrder ?? undefined)}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {loading ? 'Clustering…' : result ? 'Re-run' : 'Compute patterns'}
            </button>
          </div>
        </div>

        {/* Group order editor */}
        {groupOrder && groupOrder.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-700 mb-2">
              Condition order (left → right on the x-axis)
            </div>
            <div className="flex flex-wrap gap-2">
              {groupOrder.map((g, i) => (
                <div key={g} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs">
                  <button onClick={() => moveGroup(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <span className="font-medium text-gray-800">{g}</span>
                  <button onClick={() => moveGroup(i, 1)} disabled={i === groupOrder.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => doRun(groupOrder)}
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Apply order
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {result.n_clusters} pattern{result.n_clusters !== 1 ? 's' : ''}
            </h3>
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
              <Download className="h-4 w-4" /> Export gene → cluster (.csv)
            </button>
          </div>

          <p className="text-xs text-gray-500 mb-4">
            {result.n_genes_clustered}/{result.n_deg_used} genes clustered
            {result.n_deg_used < result.n_deg_requested
              ? ` (of ${result.n_deg_requested} DEGs)`
              : ''} · clusters below {result.min_cluster_size} genes are hidden.
            {result.downsampled && (
              <span className="text-amber-600">
                {' '}Capped to the {result.n_deg_used} most variable DEGs for performance.
              </span>
            )}
          </p>

          {result.clusters.length === 0 ? (
            <p className="text-sm text-gray-500">
              No cluster reached the minimum size. Try fewer clusters or a smaller minimum size.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {result.clusters.map((c, ci) => {
                const data = facetData(c, result.groups);
                const color = palette[ci % palette.length];
                return (
                  <div key={c.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="text-sm font-semibold text-gray-800 mb-1">
                      Cluster {c.id} <span className="text-gray-400 font-normal">· {c.n_genes} genes</span>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 25, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="group" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={40} />
                        <YAxis domain={yDomain} tick={{ fontSize: 10 }} />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Tooltip
                          contentStyle={{ fontSize: 12 }}
                          formatter={(value, name) => {
                            if (Array.isArray(value)) {
                              const [lo, hi] = value as number[];
                              return [`${lo.toFixed(2)} – ${hi.toFixed(2)}`, 'IQR'];
                            }
                            return [(value as number).toFixed(2), name === 'median' ? 'Median z' : String(name)];
                          }}
                        />
                        <Area dataKey="band" stroke="none" fill={color} fillOpacity={0.18} isAnimationActive={false} />
                        <Line dataKey="median" stroke={color} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
