'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';
import { useChartPalette } from '@/utils/chartTheme';
import ChartCard, { type ChartState } from '@/components/charts/ChartCard';

interface LibrarySizePlotProps {
  dataset: Dataset;
}

interface LibrarySizeResult {
  sample: string;
  reads: number;
}

export default function LibrarySizePlot({ dataset }: LibrarySizePlotProps) {
  const palette = useChartPalette();
  const [data, setData] = useState<LibrarySizeResult[] | null>(null);
  const ready = dataset.status === 'READY';
  // Starts idle for a dataset still processing: `true` here left the skeleton up forever, since
  // the request below only fires once the dataset is READY.
  const [loading, setLoading] = useState(ready);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    // A dataset switched before the answer lands must not paint the previous one's bars.
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/datasets/${dataset.id}/library_size`);
        if (cancelled) return;
        setData(resp.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch library size:', err);
        setError('Library size could not be computed for this dataset. Reload to try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [dataset.id, ready]);

  /** Tilted labels once sample names stop fitting side by side — 24 samples is a normal run. */
  const crowded = (data?.length ?? 0) > 8;

  // Trois sorties anticipees, trois hauteurs, et une erreur en `text-red-500` —
  // du rouge Tailwind brut, a 3,76:1 sur blanc. La carte porte les quatre etats.
  // `[]` is empty too: a dataset with no numeric sample column drew bare axes instead of saying so.
  const state: ChartState =
    loading ? 'loading' : error ? 'error' : !data || data.length === 0 ? 'empty' : 'ready';

  return (
    <ChartCard
      title="Library Size (Total Reads)"
      subtitle="Total mapped reads per sample."
      state={state}
      minHeight={400}
      exportName={`library_size_${dataset.name}`}
      error={error ?? undefined}
      empty={
        ready
          ? 'No sample column found in this dataset.'
          : 'Library size appears once the dataset has finished processing.'
      }
      className="h-full"
    >
      {/* Une hauteur en pixels, pas `100%`. Le corps de ChartCard ne porte qu'un
          `min-height` : un pourcentage n'y trouve aucune hauteur definie, se
          resout en `auto`, ResponsiveContainer mesure 0 et ne trace rien — la
          carte affichait son titre au-dessus d'un vide de 400px depuis
          l'adoption de ChartCard. */}
      <div className="w-full">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data ?? []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis
              dataKey="sample"
              {...CHART_AXIS}
              interval={0}
              angle={crowded ? -40 : 0}
              textAnchor={crowded ? 'end' : 'middle'}
              height={crowded ? 80 : 30}
            />
            <YAxis {...CHART_AXIS} tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`} />
            <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} formatter={(value: number | string | undefined) => [
                `${Number(value ?? 0).toLocaleString()} reads`,
                'Library Size',
              ]} />
            <Legend />
            <Bar dataKey="reads" fill={palette.categorical[0]} name="Reads" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
