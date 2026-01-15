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
  Legend,
  Cell
} from 'recharts';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface UMAPPlotProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

interface UMAPResult {
  data: { sample: string; x: number; y: number; z: number }[];
  n_neighbors: number;
  min_dist: number;
}

export default function UMAPPlot({ dataset, metadataDataset }: UMAPPlotProps) {
  const [umapData, setUmapData] = useState<UMAPResult | null>(null);
  const [metadata, setMetadata] = useState<any[]>([]);
  const [metadataColumns, setMetadataColumns] = useState<string[]>([]);
  const [selectedColorColumn, setSelectedColorColumn] = useState<string>('');
  const [joinColumn, setJoinColumn] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch UMAP Data
  useEffect(() => {
    const fetchUMAP = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/datasets/${dataset.id}/umap`);
        setUmapData(resp.data);
        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch UMAP:', err);
        if (err.response?.data?.detail?.includes('UMAP is not installed')) {
          setError('UMAP is not available on the server. Please install umap-learn.');
        } else {
          setError('Failed to calculate UMAP. Ensure the dataset is a valid expression matrix.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (dataset.status === 'READY') {
      fetchUMAP();
    }
  }, [dataset.id, dataset.status]);

  // Fetch Metadata if available and UMAP is ready
  useEffect(() => {
    if (!metadataDataset || metadataDataset.status !== 'READY') {
        setMetadata([]);
        setMetadataColumns([]);
        setJoinColumn('');
        setSelectedColorColumn('');
        return;
    }

    const fetchMetadata = async () => {
      if (!umapData) return;

      try {
        const resp = await api.post(`/datasets/${metadataDataset.id}/query`, {
          limit: 1000 // Assume < 1000 samples
        });
        const metaData = resp.data.data;
        setMetadata(metaData);
        
        const cols = resp.data.columns;

        // 1. Find the best column to join on (Sample ID)
        const umapSamples = new Set(umapData.data.map(d => d.sample));
        let bestJoinCol = '';
        let maxOverlap = 0;

        cols.forEach((col: string) => {
            const metaValues = metaData.map((row: any) => row[col]);
            const overlap = metaValues.filter((v: any) => umapSamples.has(String(v))).length;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestJoinCol = col;
            }
        });
        setJoinColumn(bestJoinCol);

        // 2. Filter columns suitable for coloring (categorical, < 20 unique values)
        const suitableCols = cols.filter((col: string) => {
            if (col === bestJoinCol) return false;
            const uniqueValues = new Set(metaData.map((row: any) => row[col]));
            return uniqueValues.size > 1 && uniqueValues.size < 20;
        });
        setMetadataColumns(suitableCols);
        if (suitableCols.length > 0 && (!selectedColorColumn || !suitableCols.includes(selectedColorColumn))) {
            setSelectedColorColumn(suitableCols[0]);
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };

    fetchMetadata();
  }, [metadataDataset, umapData]);

  // Merge UMAP with Metadata
  const plotData = useMemo(() => {
      if (!umapData) return [];
      if (!selectedColorColumn || metadata.length === 0 || !joinColumn) return umapData.data;

      return umapData.data.map(point => {
          const metaRow = metadata.find(m => String(m[joinColumn]) === point.sample);
          
          return {
              ...point,
              category: metaRow ? metaRow[selectedColorColumn] : 'Unknown'
          };
      });
  }, [umapData, metadata, selectedColorColumn, joinColumn]);

  // Generate Colors
  const uniqueCategories = useMemo(() => {
      if (!selectedColorColumn) return [];
      return Array.from(new Set(plotData.map((d: any) => d.category))).filter(Boolean);
  }, [plotData, selectedColorColumn]);

  const colors = ['#2A2E5B', '#00BFA5', '#7C3AED', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#a4de6c'];
  const categoryColorMap = useMemo(() => {
      const map: Record<string, string> = {};
      uniqueCategories.forEach((cat, i) => {
          map[cat as string] = colors[i % colors.length];
      });
      map['Unknown'] = '#d1d5db';
      return map;
  }, [uniqueCategories]);

  if (loading) return <div className="h-64 flex items-center justify-center text-gray-500">Calculating UMAP...</div>;
  if (error) return <div className="h-64 flex items-center justify-center text-red-500 text-sm p-4 text-center">{error}</div>;
  if (!umapData) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow h-full flex flex-col">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-lg font-medium text-gray-900">Sample UMAP</h3>
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
      </div>
      
      <div className="flex-grow min-h-0 w-full flex flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
                type="number" 
                dataKey="x" 
                name="UMAP1" 
                label={{ value: 'UMAP 1', position: 'bottom', offset: 0, fill: '#374151' }} 
                tick={{ fill: '#374151' }}
                stroke="#9ca3af"
            />
            <YAxis 
                type="number" 
                dataKey="y" 
                name="UMAP2" 
                label={{ value: 'UMAP 2', angle: -90, position: 'left', fill: '#374151' }} 
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
                    <p className="text-sm text-gray-500">UMAP1: {data.x.toFixed(2)}</p>
                    <p className="text-sm text-gray-500">UMAP2: {data.y.toFixed(2)}</p>
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
                        data={plotData.filter((d: any) => d.category === cat)} 
                        fill={categoryColorMap[cat as string]} 
                    />
                ))
            ) : (
                <Scatter name="Samples" data={umapData.data} fill="#2A2E5B" />
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
