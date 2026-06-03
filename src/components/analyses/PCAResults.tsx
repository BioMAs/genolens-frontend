'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import AIChartAssistant from '@/components/AIChartAssistant';
import { Layout, PlotData } from 'plotly.js';

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

    const traces: Partial<PlotData>[] = Object.entries(groups).map(([groupName, points], i) => ({
      type: 'scatter' as const,
      mode: 'text+markers' as const,
      name: groupName,
      x: points.map((p) => getPCValue(p, xAxis)),
      y: points.map((p) => getPCValue(p, yAxis)),
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

    const layout: Partial<Layout> = {
      autosize: true,
      height: 520,
      xaxis: {
        title: { text: `${xAxis} (${(xVar * 100).toFixed(1)}% variance)` },
        zeroline: true,
        zerolinecolor: '#e5e7eb',
        gridcolor: '#f3f4f6',
      },
      yaxis: {
        title: { text: `${yAxis} (${(yVar * 100).toFixed(1)}% variance)` },
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
  }, [pcaData, xAxis, yAxis, colorBy, availablePCs]);

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
          <label className="text-xs font-medium text-gray-600">X axis</label>
          <select
            value={xAxis}
            onChange={(e) => setXAxis(e.target.value as PCAAxisKey)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {availablePCs.map((pc) => <option key={pc} value={pc}>{pc}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Y axis</label>
          <select
            value={yAxis}
            onChange={(e) => setYAxis(e.target.value as PCAAxisKey)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs"
          >
            {availablePCs.map((pc) => <option key={pc} value={pc}>{pc}</option>)}
          </select>
        </div>
        {hasBatch && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600">Color by</label>
            <select
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as 'condition' | 'batch')}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
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

      {/* Variance explained bar */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
        <p className="text-xs font-medium text-gray-600 mb-2">Variance explained per component</p>
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
              <span className="text-xs text-gray-500">
                {pc}: {((pcaData.variance_explained[i] ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Scatter plot */}
      <div className="rounded-xl border border-gray-200 bg-white p-2">
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
