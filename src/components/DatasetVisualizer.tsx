'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
} from 'recharts';
import { Dataset, DatasetQueryResponse, DatasetType } from '@/types';
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';
import { useChartPalette } from '@/utils/chartTheme';
import ChartCard from '@/components/charts/ChartCard';

interface DatasetVisualizerProps {
  dataset: Dataset;
  data: DatasetQueryResponse;
}

export default function DatasetVisualizer({ dataset, data }: DatasetVisualizerProps) {
  const palette = useChartPalette();
  const chartData = useMemo(() => {
    if (!data || !data.data) return [];
    return data.data;
  }, [data]);

  // Simple heuristic to find plotable columns
  const { numericColumns, categoryColumn } = useMemo(() => {
    if (!data || !data.columns) return { numericColumns: [], categoryColumn: '' };

    const numericCols: string[] = [];
    let catCol = '';

    // Check first row to determine types
    if (data.data.length > 0) {
      const firstRow = data.data[0];
      data.columns.forEach(col => {
        const val = firstRow[col];
        if (typeof val === 'number') {
          numericCols.push(col);
        } else if (typeof val === 'string' && !catCol) {
          // Pick the first string column as category (e.g. Gene Name, Term)
          catCol = col;
        }
      });
    }

    return { numericColumns: numericCols, categoryColumn: catCol };
  }, [data]);

  if (!data || data.data.length === 0) {
    return <div className="p-8 text-center text-secondary">No data to visualize</div>;
  }

  // Check for Volcano Plot candidates (Log2FoldChange vs P-value)
  const volcanoX = numericColumns.find(c => c.toLowerCase().includes('log2foldchange'));
  const volcanoY = numericColumns.find(c => c.toLowerCase().includes('padj') || c.toLowerCase().includes('pvalue') || c.toLowerCase().includes('fdr'));

  if (volcanoX && volcanoY) {
    const volcanoData = chartData
      .map(d => {
        const x = Number(d[volcanoX]);
        const yRaw = Number(d[volcanoY]) || 1e-10;
        const name = typeof d[categoryColumn] === 'string' ? d[categoryColumn] : 'Gene';
        return {
          x,
          y: -Math.log10(yRaw), // -log10(pvalue)
          name,
        };
      })
      .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));

    return (
      <ChartCard
        title="Volcano plot"
        subtitle={`X: ${volcanoX} · Y: −log10(${volcanoY})`}
        minHeight={440}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis type="number" dataKey="x" name="Log2 Fold Change" />
            <YAxis type="number" dataKey="y" name="-log10(P-value)" />
            <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
            <Scatter name="Genes" data={volcanoData} fill={palette.categorical[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  // Render based on Dataset Type or Heuristics
  if (dataset.type === DatasetType.ENRICHMENT) {
    // Enrichment usually has 'term' and p-values/scores
    // Let's try to find a score column
    const scoreCol = numericColumns.find(c => 
      c.toLowerCase().includes('score') || 
      c.toLowerCase().includes('p.norm') ||
      c.toLowerCase().includes('log')
    ) || numericColumns[0];

    return (
      <ChartCard
        title="Enrichment overview"
        minHeight={440}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData.slice(0, 20)} // Top 20
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid {...CHART_GRID} />
            <XAxis type="number" />
            <YAxis 
              dataKey={categoryColumn || 'term'} 
              type="category" 
              width={150} 
              {...CHART_AXIS}
            />
            <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
            <Legend />
            <Bar dataKey={scoreCol} fill={palette.categorical[0]} name={scoreCol} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-body-sm text-secondary mt-2 text-center">Top 20 items by {scoreCol}</p>
      </ChartCard>
    );
  }

  if (dataset.type === DatasetType.MATRIX) {
    // Matrix usually has samples as columns and genes as rows
    // We can plot distribution of the first few samples
    const samplesToPlot = numericColumns.slice(0, 5);

    return (
      <ChartCard
        title="Expression distribution"
        subtitle="First 5 samples"
        minHeight={440}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.slice(0, 50)}>
            <CartesianGrid {...CHART_GRID} />
            <XAxis dataKey={categoryColumn || 'gene_id'} />
            <YAxis />
            <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
            <Legend />
            {samplesToPlot.map((sample, idx) => (
              <Bar key={sample} dataKey={sample} fill={palette.categorical[idx % palette.categorical.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-body-sm text-secondary mt-2 text-center">First 50 genes</p>
      </ChartCard>
    );
  }

  // Default Fallback
  return (
    <ChartCard
      title="Data overview"
      minHeight={440}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData.slice(0, 20)}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis dataKey={categoryColumn} />
          <YAxis />
          <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
          <Legend />
          {numericColumns.slice(0, 3).map((col, idx) => (
            <Bar key={col} dataKey={col} fill={palette.categorical[idx % palette.categorical.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
