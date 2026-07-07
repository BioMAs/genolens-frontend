'use client';

import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';
import type { ChatFigureData } from '@/hooks/useChatAgent';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

/**
 * Renders an inline figure produced by the chat agent. The server builds a full
 * Plotly figure spec ({data, layout}) from the constrained chart request, so this
 * component is a single, generic Plotly renderer — no per-chart-type branching.
 * The modebar exposes a native PNG download named after the comparison + chart type.
 */
export default function PlotlyFigure({
  figure,
  comparisonName,
}: {
  figure: ChatFigureData;
  comparisonName?: string;
}) {
  const spec = figure.spec;
  const data = (spec?.data ?? []) as Data[];
  const layout = (spec?.layout ?? {}) as Partial<Layout>;

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
        No data returned for this figure.
      </div>
    );
  }

  const chartType = (figure.params?.chart_type as string) ?? 'chart';
  const filename = `${comparisonName ?? 'genolens'}_${chartType}`;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
      <Plot
        data={data}
        layout={{
          autosize: true,
          height: 360,
          font: { size: 12 },
          ...layout,
        }}
        config={{
          displayModeBar: true,
          displaylogo: false,
          responsive: true,
          modeBarButtonsToRemove: ['select2d', 'lasso2d'],
          toImageButtonOptions: {
            format: 'png',
            filename,
            height: 600,
            width: 900,
            scale: 2,
          },
        }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}
