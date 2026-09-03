'use client';

import { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useVolcanoPoints } from '@/hooks/useVisualizations';
import { deriveSignificance, isSignificant, type VolcanoPoint } from '@/utils/volcano';
import { useComparisonActions, useThresholds, useViewPreferences } from '@/contexts/ComparisonSelectionContext';
import { Dataset } from '@/types';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

interface VolcanoPlotProps {
  dataset: Dataset;
  comparisonName: string;
}

/** A cloud point plus the verdict recomputed at the page's current thresholds. */
type ScoredPoint = VolcanoPoint & { significant: boolean };

/**
 * Volcano plot of one comparison.
 *
 * It no longer owns thresholds. They live in `ComparisonSelectionContext`, shared with the DEG
 * table below and the synthesis strip above, so the three can no longer disagree — previously
 * each held its own pair and the pane header printed a third, fixed, pair as text.
 *
 * It also no longer refetches when a threshold moves. The endpoint returns the same point cloud
 * whatever thresholds it is given and only recomputes a flag (`datasets.py:2014-2044`), so the
 * cloud is fetched once via `useVolcanoPoints` — whose query key deliberately excludes the
 * thresholds — and significance is derived here.
 */
export default function VolcanoPlot({ dataset, comparisonName }: VolcanoPlotProps) {
  const thresholds = useThresholds();
  const { colorblind } = useViewPreferences();
  const { setColorblind } = useComparisonActions();
  const palette = getPalette(colorblind ? 'colorblind' : 'standard');

  const { data: volcanoData, isLoading, error, isFetching } = useVolcanoPoints(
    dataset.id,
    comparisonName
  );

  const points = volcanoData?.points;
  const isCached = volcanoData?.cached ?? false;

  // One pass over the cloud per threshold change — no request, no refetch.
  const scored = useMemo<ScoredPoint[]>(
    () => (points ?? []).map((p) => ({ ...p, significant: isSignificant(p, thresholds) })),
    [points, thresholds]
  );

  const summary = useMemo(
    () => deriveSignificance(points ?? [], thresholds),
    [points, thresholds]
  );

  const aiContext = useMemo(() => {
    const up = scored.filter((p) => p.significant && p.x > 0);
    const down = scored.filter((p) => p.significant && p.x < 0);
    return {
      comparison_name: comparisonName,
      up_count: up.length,
      down_count: down.length,
      padj_threshold: thresholds.padj,
      logfc_threshold: thresholds.logfc,
      top_up_genes: [...up]
        .sort((a, b) => b.x - a.x)
        .slice(0, 5)
        .map((p) => ({ gene_id: p.gene, log_fc: p.x })),
      top_down_genes: [...down]
        .sort((a, b) => a.x - b.x)
        .slice(0, 5)
        .map((p) => ({ gene_id: p.gene, log_fc: p.x })),
    };
  }, [scored, comparisonName, thresholds]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading plot data…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Failed to load plot data.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isFetching && (
            <span className="text-xs" style={{ color: 'var(--sl-violet)' }}>
              Loading…
            </span>
          )}
          {isCached && !isFetching && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Cached
            </span>
          )}
        </div>
        <ColorblindToggle value={colorblind} onChange={setColorblind} />
      </div>

      <AIChartAssistant
        datasetId={dataset.id}
        chartType="volcano"
        contextKey={comparisonName}
        context={aiContext}
        label="Volcano Plot"
        panelClassName="max-h-[500px]"
      />

      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid stroke="var(--border)" />
            <XAxis
              type="number"
              dataKey="x"
              name="log2 Fold Change"
              label={{ value: 'log2 Fold Change', position: 'bottom' }}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="-log10(padj)"
              label={{ value: '-log10(padj)', angle: -90, position: 'left' }}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as ScoredPoint;
                return (
                  <div
                    className="p-3"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <p className="mb-1 text-sm font-semibold">{d.gene}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      log2FC: <span className="font-mono">{d.x.toFixed(2)}</span>
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      padj: <span className="font-mono">{d.padj.toExponential(2)}</span>
                    </p>
                  </div>
                );
              }}
            />
            <ReferenceLine x={0} stroke="var(--border)" strokeDasharray="3 3" />
            <ReferenceLine x={thresholds.logfc} stroke="#fbbf24" strokeDasharray="2 2" />
            <ReferenceLine x={-thresholds.logfc} stroke="#fbbf24" strokeDasharray="2 2" />
            <ReferenceLine
              y={-Math.log10(thresholds.padj)}
              stroke="#fbbf24"
              strokeDasharray="2 2"
              label={`padj=${thresholds.padj}`}
            />
            <Scatter
              name="Genes"
              data={scored}
              isAnimationActive={false}
              shape={(props: { cx?: number; cy?: number; fill?: string }) => (
                <circle cx={props.cx} cy={props.cy} r={1} fill={props.fill} fillOpacity={0.8} />
              )}
            >
              {scored.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.significant ? (entry.x > 0 ? palette.up : palette.down) : palette.ns}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div
        className="mt-6 flex flex-col items-center gap-3 pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-semibold">{summary.significant.toLocaleString('en-US')}</span>{' '}
          significant of{' '}
          <span className="font-semibold">{summary.total.toLocaleString('en-US')}</span> plotted
        </div>
        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {[
            { color: palette.up, label: 'Upregulated' },
            { color: palette.down, label: 'Downregulated' },
            { color: palette.ns, label: 'Not significant' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3"
                style={{ background: color, borderRadius: 3 }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
