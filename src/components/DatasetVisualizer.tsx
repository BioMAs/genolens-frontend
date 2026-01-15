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
  ZAxis
} from 'recharts';
import { Dataset, DatasetQueryResponse, DatasetType } from '@/types';

interface DatasetVisualizerProps {
  dataset: Dataset;
  data: DatasetQueryResponse;
}

export default function DatasetVisualizer({ dataset, data }: DatasetVisualizerProps) {
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
    return <div className="p-8 text-center text-gray-500">No data to visualize</div>;
  }

  // Check for Volcano Plot candidates (Log2FoldChange vs P-value)
  const volcanoX = numericColumns.find(c => c.toLowerCase().includes('log2foldchange'));
  const volcanoY = numericColumns.find(c => c.toLowerCase().includes('padj') || c.toLowerCase().includes('pvalue') || c.toLowerCase().includes('fdr'));

  if (volcanoX && volcanoY) {
    const volcanoData = chartData.map(d => ({
      ...d,
      x: d[volcanoX],
      y: -Math.log10(Number(d[volcanoY]) || 1e-10), // -log10(pvalue)
      name: d[categoryColumn] || 'Gene'
    })).filter(d => !isNaN(d.x) && !isNaN(d.y));

    return (
      <div className="h-[500px] w-full bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Volcano Plot</h3>
        <div className="text-sm text-gray-500 mb-2">
          X: {volcanoX} | Y: -log10({volcanoY})
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid />
            <XAxis type="number" dataKey="x" name="Log2 Fold Change" />
            <YAxis type="number" dataKey="y" name="-log10(P-value)" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Genes" data={volcanoData} fill="#8884d8" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
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
      <div className="h-[500px] w-full bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Enrichment Overview</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData.slice(0, 20)} // Top 20
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis 
              dataKey={categoryColumn || 'term'} 
              type="category" 
              width={150} 
              tick={{fontSize: 12}}
            />
            <Tooltip />
            <Legend />
            <Bar dataKey={scoreCol} fill="#8884d8" name={scoreCol} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-sm text-gray-500 mt-2 text-center">Top 20 items by {scoreCol}</p>
      </div>
    );
  }

  if (dataset.type === DatasetType.MATRIX) {
    // Matrix usually has samples as columns and genes as rows
    // We can plot distribution of the first few samples
    const samplesToPlot = numericColumns.slice(0, 5);

    return (
      <div className="h-[500px] w-full bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium mb-4">Expression Distribution (First 5 Samples)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData.slice(0, 50)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={categoryColumn || 'gene_id'} />
            <YAxis />
            <Tooltip />
            <Legend />
            {samplesToPlot.map((sample, idx) => (
              <Bar key={sample} dataKey={sample} fill={`hsl(${idx * 60}, 70%, 50%)`} />
            ))}
          </BarChart>
        </ResponsiveContainer>
        <p className="text-sm text-gray-500 mt-2 text-center">First 50 genes</p>
      </div>
    );
  }

  // Default Fallback
  return (
    <div className="h-[500px] w-full bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-medium mb-4">Data Overview</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData.slice(0, 20)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={categoryColumn} />
          <YAxis />
          <Tooltip />
          <Legend />
          {numericColumns.slice(0, 3).map((col, idx) => (
            <Bar key={col} dataKey={col} fill={`hsl(${idx * 100}, 70%, 50%)`} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
