'use client';

import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';
import type { ChatFigureData } from '@/hooks/useChatAgent';
import { useChartTheme } from '@/utils/chartTheme';
import { buildPlotlyConfig, mergePlotlyLayout } from '@/utils/plotlyLayout';

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
  const chartTheme = useChartTheme();
  const data = (spec?.data ?? []) as Data[];
  const layout = (spec?.layout ?? {}) as Partial<Layout>;

  if (data.length === 0) {
    return (
      <div className="rounded-control border border-[var(--border)] bg-[var(--surface)] p-3 text-caption text-[var(--text-muted)]">
        No data returned for this figure.
      </div>
    );
  }

  const chartType = (figure.params?.chart_type as string) ?? 'chart';
  const filename = `${comparisonName ?? 'genolens'}_${chartType}`;

  return (
    <div className="rounded-control border border-[var(--border)] bg-[var(--surface)] p-2">
      <Plot
        data={data}
        // La mise en page venait de l'assistant et etait etalee EN DERNIER :
        // `{...defauts, ...layout}` la laissait donc tout ecraser. Sans
        // consequence tant qu'il n'y avait pas de defauts de theme ; fatal des
        // que la fabrique arrive. mergePlotlyLayout distingue trois classes de
        // cles et reapplique la chrome en dernier, de sorte qu'une cle emise
        // par une version future de l'agent ne puisse pas la casser.
        layout={mergePlotlyLayout(chartTheme, { height: 360, ...(layout ?? {}) })}
        config={buildPlotlyConfig({ filename })}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}
