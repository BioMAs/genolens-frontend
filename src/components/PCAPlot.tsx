'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { usePCAData } from '@/hooks/useVisualizations';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

interface PCAPlotProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

type MetadataRow = Record<string, string | number | boolean | null>;

interface PCADataPoint {
  sample: string;
  x: number;
  y: number;
  z: number;
  category?: string | number | boolean | null;
}

export default function PCAPlot({ dataset, metadataDataset }: PCAPlotProps) {
  // Utilise React Query pour gérer le cache PCA
  const { data: pcaData, isLoading, error: pcaError } = usePCAData(
    dataset.id,
    {},
    dataset.status === 'READY'
  );
  
  const [metadata, setMetadata] = useState<MetadataRow[]>([]);
  const [metadataColumns, setMetadataColumns] = useState<string[]>([]);
  const [selectedColorColumn, setSelectedColorColumn] = useState<string>('');
  const [joinColumn, setJoinColumn] = useState<string>('');
  const [colorblindMode, setColorblindMode] = useState(false);
  const palette = getPalette(colorblindMode ? 'colorblind' : 'standard');

  const error = pcaError ? 'Failed to calculate PCA. Ensure the dataset is a valid expression matrix.' : null;

  // Fetch Metadata if available and PCA is ready
  useEffect(() => {
    if (!metadataDataset || metadataDataset.status !== 'READY') {
        // Reset state when metadata dataset is unavailable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
        setMetadata([]);
        setMetadataColumns([]);
        setJoinColumn('');
        setSelectedColorColumn('');
        return;
    }

    const fetchMetadata = async () => {
      if (!pcaData) return;

      try {
        const resp = await api.post(`/datasets/${metadataDataset.id}/query`, {
          limit: 1000 // Assume < 1000 samples
        });
        const metaData = resp.data.data;
        setMetadata(metaData);
        
        const cols = resp.data.columns;

        // 1. Find the best column to join on (Sample ID)
        const pcaSamples = new Set((pcaData.data as PCADataPoint[]).map((d) => d.sample));
        let bestJoinCol = '';
        let maxOverlap = 0;

        cols.forEach((col: string) => {
          const metaValues = (metaData as MetadataRow[]).map((row) => row[col]);
          const overlap = metaValues.filter((v) => pcaSamples.has(String(v))).length;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestJoinCol = col;
            }
        });
        setJoinColumn(bestJoinCol);

        // 2. Filter columns suitable for coloring (categorical, < 20 unique values)
        // Exclude the join column itself if it's unique per sample (likely)
        const suitableCols = cols.filter((col: string) => {
            if (col === bestJoinCol) return false;
          const uniqueValues = new Set((metaData as MetadataRow[]).map((row) => row[col]));
            return uniqueValues.size > 1 && uniqueValues.size < 20;
        });
        setMetadataColumns(suitableCols);
        // Only set selectedColorColumn if it's not already set or not in the new list
        if (suitableCols.length > 0 && (!selectedColorColumn || !suitableCols.includes(selectedColorColumn))) {
            setSelectedColorColumn(suitableCols[0]);
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };

    fetchMetadata();
  }, [metadataDataset, pcaData, selectedColorColumn]);

  // Merge PCA with Metadata
  const plotData = useMemo(() => {
      if (!pcaData) return [];
      if (!selectedColorColumn || metadata.length === 0 || !joinColumn) return pcaData.data;

        return (pcaData.data as PCADataPoint[]).map((point) => {
          // Find matching metadata row using the detected join column
          const metaRow = metadata.find((m) => String(m[joinColumn]) === point.sample);
          
          return {
              ...point,
              category: metaRow ? metaRow[selectedColorColumn] : 'Unknown'
          };
      });
  }, [pcaData, metadata, selectedColorColumn, joinColumn]);

  // Generate Colors
  const uniqueCategories = useMemo(() => {
      if (!selectedColorColumn) return [];
      return Array.from(new Set((plotData as PCADataPoint[]).map((d) => d.category))).filter(Boolean);
  }, [plotData, selectedColorColumn]);

  const categoryColorMap = useMemo(() => {
      const map: Record<string, string> = {};
      uniqueCategories.forEach((cat, i) => {
          map[cat as string] = palette.categorical[i % palette.categorical.length];
      });
      map['Unknown'] = '#d1d5db';
      return map;
  }, [uniqueCategories, palette]);

  if (isLoading) return <div className="h-64 flex items-center justify-center text-gray-500">Calculating PCA...</div>;
  if (error) return <div className="h-64 flex items-center justify-center text-red-500 text-sm p-4 text-center">{error}</div>;
  if (!pcaData) return null;

  const xLabel = `PC1 (${(pcaData.explained_variance[0] * 100).toFixed(1)}%)`;
  const yLabel = `PC2 (${(pcaData.explained_variance[1] * 100).toFixed(1)}%)`;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Sample PCA</h3>
        <div className="flex items-center gap-2">
          {metadataColumns.length > 0 && (
              <select
                  value={selectedColorColumn}
                  onChange={(e) => setSelectedColorColumn(e.target.value)}
                  className="text-sm border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary border p-1 text-gray-900"
              >
                  {metadataColumns.map(col => (
                      <option key={col} value={col}>Color by: {col}</option>
                  ))}
              </select>
          )}
          <ColorblindToggle value={colorblindMode} onChange={setColorblindMode} />
          <AIChartAssistant
            datasetId={dataset.id}
            chartType="pca"
            contextKey="pca-default"
            context={{
              variance_pc1: pcaData ? +(pcaData.explained_variance[0] * 100).toFixed(1) : 0,
              variance_pc2: pcaData ? +(pcaData.explained_variance[1] * 100).toFixed(1) : 0,
              n_samples: pcaData?.data?.length ?? 0,
              n_genes: 0,
              sample_groups: Array.from(new Set((plotData as PCADataPoint[]).map((d) => String(d.category ?? 'Unknown')))),
              group_separation: true,
            }}
            label="PCA Plot"
          />
        </div>
      </div>

      <div>
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
                type="number" 
                dataKey="x" 
                name="PC1" 
                label={{ value: xLabel, position: 'bottom', offset: 0, fill: '#374151' }} 
                tick={{ fill: '#374151' }}
                stroke="#9ca3af"
            />
            <YAxis 
                type="number" 
                dataKey="y" 
                name="PC2" 
                label={{ value: yLabel, angle: -90, position: 'left', fill: '#374151' }} 
                tick={{ fill: '#374151' }}
                stroke="#9ca3af"
            />
            <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-2 border border-gray-200 shadow-sm rounded">
                    <p className="font-medium text-gray-900">{data.sample}</p>
                    {data.category && <p className="text-xs text-gray-500">{selectedColorColumn}: {data.category}</p>}
                    <p className="text-sm text-gray-500">PC1: {data.x.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">PC2: {data.y.toFixed(2)}</p>
                  </div>
                );
              }
              return null;
            }} />
            <Legend 
              verticalAlign="bottom" 
              align="center"
              wrapperStyle={{ 
                paddingTop: '20px',
                color: '#374151'
              }} 
            />
            {uniqueCategories.length > 0 ? (
                uniqueCategories.map((cat) => (
                    <Scatter 
                        key={cat as string} 
                        name={cat as string} 
                        data={(plotData as PCADataPoint[]).filter((d) => d.category === cat)} 
                        fill={categoryColorMap[cat as string]}
                        shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3} fill={props.fill} fillOpacity={0.85} />}
                    />
                ))
            ) : (
                <Scatter name="Samples" data={pcaData.data} fill="#2A2E5B" shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={3} fill={props.fill} fillOpacity={0.85} />} />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
