'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface UMAPPoint {
  sample_id: string;
  UMAP1: number;
  UMAP2: number;
  condition?: string;
  batch?: string;
}

interface UMAPResultsProps {
  umapData: UMAPPoint[] | null;
}

const CONDITION_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
];

export default function UMAPResults({ umapData }: UMAPResultsProps) {
  const { traces, layout } = useMemo(() => {
    if (!umapData || umapData.length === 0) return { traces: [] as Data[], layout: {} };

    const groups: Record<string, UMAPPoint[]> = {};
    umapData.forEach((s) => {
      const key = s.condition ?? 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });

    const traces = Object.entries(groups).map(([groupName, points], i) => ({
      type: 'scatter' as const,
      mode: 'markers+text' as const,
      name: groupName,
      x: points.map((p) => p.UMAP1),
      y: points.map((p) => p.UMAP2),
      text: points.map((p) => p.sample_id),
      textposition: 'top center' as const,
      textfont: { size: 9, color: '#6b7280' },
      marker: {
        size: 10,
        color: CONDITION_COLORS[i % CONDITION_COLORS.length],
        opacity: 0.85,
        line: { width: 1, color: '#fff' },
      },
    }));

    const layout = {
      autosize: true,
      height: 520,
      xaxis: {
        title: 'UMAP1',
        zeroline: true,
        zerolinecolor: '#e5e7eb',
        gridcolor: '#f3f4f6',
      },
      yaxis: {
        title: 'UMAP2',
        zeroline: true,
        zerolinecolor: '#e5e7eb',
        gridcolor: '#f3f4f6',
      },
      legend: { orientation: 'v' as const, x: 1.02, y: 1 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: '#fafafa',
      margin: { l: 60, r: 140, t: 30, b: 60 },
      hovermode: 'closest' as const,
    };

    return { traces, layout };
  }, [umapData]);

  if (!umapData) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
        <p className="text-sm text-yellow-700 font-medium">UMAP data not available for this analysis.</p>
        <p className="text-xs text-yellow-600 mt-1">
          This analysis was run with an older pipeline. Re-run to generate UMAP from VST-transformed counts.
        </p>
      </div>
    );
  }

  if (umapData.length === 0) {
    return <p className="text-sm text-gray-400">No UMAP data points.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Plot
          data={traces as unknown as Data[]}
          layout={layout as unknown as Partial<Layout>}
          style={{ width: '100%' }}
          config={{ responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }}
        />
      </div>
      <p className="text-xs text-gray-400">
        UMAP computed with <code>uwot</code> on the top 500 most variable genes (VST-transformed).
        n_neighbors = min(15, n_samples − 1), Euclidean distance, seed = 42.
      </p>
    </div>
  );
}
