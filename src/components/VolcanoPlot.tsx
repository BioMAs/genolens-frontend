'use client';

import { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface VolcanoPlotProps {
  dataset: Dataset;
  comparisonName: string;
}

export default function VolcanoPlot({ dataset, comparisonName }: VolcanoPlotProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalGenes, setTotalGenes] = useState(0);
  const [significantGenes, setSignificantGenes] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Use optimized volcano plot endpoint
        const response = await api.get(
          `/datasets/${dataset.id}/volcano-plot/${encodeURIComponent(comparisonName)}`,
          {
            params: {
              max_points: 5000, // Limit for performance
              force_recalculate: true // Bypass old 2000-point cache
            }
          }
        );

        const points = response.data.points || [];
        setTotalGenes(response.data.total_genes || 0);
        setSignificantGenes(response.data.significant_genes || 0);

        console.log('[VolcanoPlot] Loaded', points.length, 'points');
        console.log('[VolcanoPlot] Total genes:', response.data.total_genes);
        console.log('[VolcanoPlot] Significant:', response.data.significant_genes);
        
        setData(points);
      } catch (err) {
        console.error('Failed to fetch volcano data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset && comparisonName) {
        fetchData();
    }
  }, [dataset, comparisonName]);

  if (loading) return <div>Loading plot data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="h-96 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid />
          <XAxis type="number" dataKey="x" name="log2 Fold Change" label={{ value: 'log2 Fold Change', position: 'bottom' }} />
          <YAxis type="number" dataKey="y" name="-log10(p-value)" label={{ value: '-log10(p-value)', angle: -90, position: 'left' }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
              if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                      <div className="bg-white p-3 border-2 border-gray-300 shadow-lg rounded-lg">
                          <p className="font-bold text-base text-gray-900 mb-1">{d.gene}</p>
                          <p className="text-sm text-gray-700 font-medium">log2FC: <span className="font-mono">{d.x.toFixed(2)}</span></p>
                          <p className="text-sm text-gray-700 font-medium">p-value: <span className="font-mono">{d.padj.toExponential(2)}</span></p>
                      </div>
                  );
              }
              return null;
          }} />
          <ReferenceLine x={0} stroke="#666" strokeDasharray="3 3" />
          <ReferenceLine y={-Math.log10(0.05)} stroke="#666" strokeDasharray="3 3" label="p=0.05" />
          <Scatter name="Genes" data={data} fill="#8884d8" shape="circle" r={1.5}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.is_significant ? (entry.x > 0 ? '#ef4444' : '#00BFA5') : '#d1d5db'} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      
      {/* Legend and Stats */}
      <div className="flex flex-col items-center gap-3 mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <span className="font-semibold">{significantGenes.toLocaleString()}</span> significant genes out of <span className="font-semibold">{totalGenes.toLocaleString()}</span> total
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Significance:</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <div className="w-6 h-6 rounded bg-red-500 mr-1.5"></div>
                <span className="text-sm text-gray-600">Upregulated</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded mr-1.5" style={{backgroundColor: '#00BFA5'}}></div>
                <span className="text-sm text-gray-600">Downregulated</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded bg-gray-300 mr-1.5"></div>
                <span className="text-sm text-gray-600">Not Significant</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          Significant: padj &lt; 0.05 and |log2FC| &gt; 0.58
        </p>
      </div>
    </div>
  );
}
