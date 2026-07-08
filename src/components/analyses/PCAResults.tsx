'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import AIChartAssistant from '@/components/AIChartAssistant';
import { Layout, PlotData } from 'plotly.js';
import { useTheme } from '@/contexts/ThemeContext';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PCAPoint {
  sample_id: string;
  PC1?: number;
  PC2?: number;
  PC3?: number;
  PC4?: number;
  condition?: string;
  batch?: string;
}

export interface PCAData {
  variance_explained: number[];
  pc_labels: string[];
  samples: PCAPoint[];
}

type PCAAxisKey = 'PC1' | 'PC2' | 'PC3' | 'PC4';

interface PCAResultsProps {
  pcaData: PCAData | null;
  datasetId?: string;
}

const CONDITION_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

export default function PCAResults({ pcaData, datasetId }: PCAResultsProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [xAxis, setXAxis] = useState<PCAAxisKey>('PC1');
  const [yAxis, setYAxis] = useState<PCAAxisKey>('PC2');
  const [colorBy, setColorBy] = useState<'condition' | 'batch'>('condition');

  const availablePCs = useMemo(() => {
    const labels = pcaData?.pc_labels ?? [];
    return labels.filter((pc): pc is PCAAxisKey => ['PC1', 'PC2', 'PC3', 'PC4'].includes(pc));
  }, [pcaData?.pc_labels]);

  const getPCValue = (point: PCAPoint, axis: PCAAxisKey): number => {
    if (axis === 'PC1') return point.PC1 ?? 0;
    if (axis === 'PC2') return point.PC2 ?? 0;
    if (axis === 'PC3') return point.PC3 ?? 0;
    return point.PC4 ?? 0;
  };

  const { traces, layout } = useMemo(() => {
    if (!pcaData || pcaData.samples.length === 0) return { traces: [], layout: {} };

    const groups: Record<string, PCAPoint[]> = {};
    pcaData.samples.forEach((s) => {
      const groupKey = colorBy === 'batch'
        ? (s.batch ?? 'Unknown')
        : (s.condition ?? 'Unknown');
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(s);
    });

    const xIdx = availablePCs.indexOf(xAxis);
    const yIdx = availablePCs.indexOf(yAxis);
    const xVar = pcaData.variance_explained[xIdx] ?? 0;
    const yVar = pcaData.variance_explained[yIdx] ?? 0;

    // Soft group halos: an ellipse (±1.8σ) behind each group's points.
    const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
    const std = (a: number[], m: number) =>
      a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : 0;
    const allX = pcaData.samples.map((p) => getPCValue(p, xAxis));
    const allY = pcaData.samples.map((p) => getPCValue(p, yAxis));
    const fallbackX = (Math.max(...allX) - Math.min(...allX)) * 0.06 || 1;
    const fallbackY = (Math.max(...allY) - Math.min(...allY)) * 0.06 || 1;

    const shapes = Object.entries(groups).map(([, points], i) => {
      const xs = points.map((p) => getPCValue(p, xAxis));
      const ys = points.map((p) => getPCValue(p, yAxis));
      const mx = mean(xs);
      const my = mean(ys);
      const sx = (std(xs, mx) || fallbackX) * 1.8;
      const sy = (std(ys, my) || fallbackY) * 1.8;
      const color = CONDITION_COLORS[i % CONDITION_COLORS.length];
      return {
        type: 'circle' as const,
        xref: 'x' as const,
        yref: 'y' as const,
        x0: mx - sx,
        x1: mx + sx,
        y0: my - sy,
        y1: my + sy,
        fillcolor: color,
        opacity: 0.08,
        line: { color, width: 1, dash: 'dot' as const },
        layer: 'below' as const,
      };
    });

    const traces: Partial<PlotData>[] = Object.entries(groups).map(([groupName, points], i) => ({
      type: 'scatter' as const,
      mode: 'text+markers' as const,
      name: groupName,
      x: points.map((p) => getPCValue(p, xAxis)),
      y: points.map((p) => getPCValue(p, yAxis)),
      text: points.map((p) => p.sample_id),
      textposition: 'top center' as const,
      textfont: { size: 9, color: isDark ? '#9ca3af' : '#6b7280' },
      marker: {
        size: 10,
        color: CONDITION_COLORS[i % CONDITION_COLORS.length],
        opacity: 0.85,
        line: { width: 1, color: isDark ? '#374151' : '#fff' },
      },
    }));

    const layout: Partial<Layout> = {
      autosize: true,
      height: 520,
      font: { color: isDark ? '#d1d5db' : '#374151' },
      xaxis: {
        title: { text: `${xAxis} (${(xVar * 100).toFixed(1)}% variance)` },
        zeroline: true,
        zerolinecolor: isDark ? '#374151' : '#e5e7eb',
        gridcolor: isDark ? '#1f2937' : '#f3f4f6',
        color: isDark ? '#9ca3af' : '#6b7280',
      },
      yaxis: {
        title: { text: `${yAxis} (${(yVar * 100).toFixed(1)}% variance)` },
        zeroline: true,
        zerolinecolor: isDark ? '#374151' : '#e5e7eb',
        gridcolor: isDark ? '#1f2937' : '#f3f4f6',
        color: isDark ? '#9ca3af' : '#6b7280',
      },
      legend: { orientation: 'v' as const, x: 1.02, y: 1, font: { color: isDark ? '#d1d5db' : '#374151' } },
      paper_bgcolor: 'transparent',
      plot_bgcolor: isDark ? '#1a1f2e' : '#fafafa',
      margin: { l: 60, r: 140, t: 30, b: 60 },
      hovermode: 'closest' as const,
      shapes,
    };

    return { traces, layout };
  }, [pcaData, xAxis, yAxis, colorBy, availablePCs, isDark]);

  // Plain-language read of the plot.
  const read = useMemo(() => {
    if (!pcaData) return null;
    const xIdx = availablePCs.indexOf(xAxis);
    const pcVar = (pcaData.variance_explained[xIdx] ?? 0) * 100;
    const nGroups = new Set(
      pcaData.samples.map((s) => (colorBy === 'batch' ? s.batch : s.condition) ?? 'Unknown'),
    ).size;
    return `${xAxis} captures ${pcVar.toFixed(1)}% of the variance. Points are coloured across ${nGroups} ${colorBy} group${nGroups === 1 ? '' : 's'}; tighter halos mean a more coherent group.`;
  }, [pcaData, xAxis, colorBy, availablePCs]);

  if (!pcaData) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
        <p className="text-sm text-yellow-700 font-medium">PCA data not available for this analysis.</p>
        <p className="text-xs text-yellow-600 mt-1">Re-run the analysis to generate PCA from VST-transformed counts.</p>
      </div>
    );
  }

  if (pcaData.samples.length === 0) {
    return <p className="text-sm text-gray-400">No PCA data points.</p>;
  }

  const hasBatch = pcaData.samples.some((s) => s.batch);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>X axis</label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value as PCAAxisKey)}
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {availablePCs.map((pc) => <option key={pc} value={pc}>{pc}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Y axis</label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value as PCAAxisKey)}
            className="rounded-md px-2 py-1 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            {availablePCs.map((pc) => <option key={pc} value={pc}>{pc}</option>)}
          </select>
        </div>
        {hasBatch && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Color by</label>
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as 'condition' | 'batch')}
              className="rounded-md px-2 py-1 text-xs"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <option value="condition">Condition</option>
              <option value="batch">Batch</option>
            </select>
          </div>
        )}
        </div>
        {datasetId && (
          <AIChartAssistant
            datasetId={datasetId}
            chartType="pca"
            contextKey="pca-analysis"
            context={{
              variance_explained: pcaData.variance_explained,
              pc_labels: pcaData.pc_labels,
              n_samples: pcaData.samples.length,
              conditions: [...new Set(pcaData.samples.map((s) => s.condition).filter(Boolean))],
            }}
            label="PCA"
            panelClassName="max-h-[500px]"
          />
        )}
      </div>

      {/* Plain-language read */}
      {read && (
        <div
          className="flex items-start gap-2.5 rounded-xl border p-3.5"
          style={{ background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }}
        >
          <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--dc-green)' }} />
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {read}
          </p>
        </div>
      )}

      {/* Variance explained bar */}
      <div className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Variance explained per component</p>
        <div className="flex flex-wrap gap-2">
          {pcaData.pc_labels.map((pc, i) => (
            <div key={pc} className="flex items-center gap-1.5">
              <div
                className="h-3 rounded-sm"
                style={{
                  width: `${Math.max(12, (pcaData.variance_explained[i] ?? 0) * 120)}px`,
                  backgroundColor: CONDITION_COLORS[i % CONDITION_COLORS.length],
                  opacity: 0.7,
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {pc}: {((pcaData.variance_explained[i] ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter plot */}
      <div className="rounded-xl p-2" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
        <Plot
          data={traces}
          layout={layout}
          useResizeHandler
          style={{ width: '100%' }}
          config={{ displayModeBar: true, responsive: true }}
        />
      </div>
    </div>
  );
}
