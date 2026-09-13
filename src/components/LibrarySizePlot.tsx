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
import { CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/datasets/${dataset.id}/library_size`);
        setData(resp.data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch library size:', err);
        setError('Failed to calculate library size.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset.status === 'READY') {
      fetchData();
    }
  }, [dataset.id, dataset.status]);

  // Trois sorties anticipees, trois hauteurs, et une erreur en `text-red-500` —
  // du rouge Tailwind brut, a 3,76:1 sur blanc. La carte porte les quatre etats.
  const state: ChartState = loading ? 'loading' : error ? 'error' : !data ? 'empty' : 'ready';

  return (
    <ChartCard
      title="Library Size (Total Reads)"
      subtitle="Total mapped reads per sample."
      state={state}
      minHeight={400}
      exportName={`library_size_${dataset.name}`}
      error={error ?? undefined}
      empty="No library-size data for this dataset."
      className="h-full"
    >
      <div className="h-full min-h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data ?? []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey="sample" />
            <YAxis tickFormatter={(value) => `${(value / 1e6).toFixed(1)}M`} />
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
