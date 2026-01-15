'use client';

import { useEffect, useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ZAxis } from 'recharts';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface EnrichmentPlotProps {
  dataset: Dataset;
  comparisonName?: string;
}

export default function EnrichmentPlot({ dataset, comparisonName }: EnrichmentPlotProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.post(`/datasets/${dataset.id}/query`, {
          limit: 1000 // Get more rows to filter
        });
        
        let rawData = response.data.data;
        const cols = response.data.columns;

        // If comparisonName is provided, filter by gene_cluster column
        if (comparisonName) {
            const clusterCol = cols.find((c: string) => 
                c.toLowerCase() === 'gene_cluster' || 
                c.toLowerCase() === 'genecluster' || 
                c.toLowerCase() === 'gene.cluster' ||
                c.toLowerCase() === 'cluster' ||
                c.toLowerCase() === 'comparison'
            );
            
            if (clusterCol) {
                rawData = rawData.filter((row: any) => {
                    const clusterValue = String(row[clusterCol] || '');
                    // Match comparison name with or without _up/_down suffix
                    return clusterValue.includes(comparisonName) || 
                           clusterValue.replace(/_up|_down|_upregulated|_downregulated/gi, '') === comparisonName;
                });
            }
        }

        // Identify columns
        const descCol = cols.find((c: string) => 
            c.toLowerCase().includes('description') || 
            c.toLowerCase().includes('term') ||
            c.toLowerCase() === 'term'
        );
        
        // P-value column: adj.p.hyper.enri
        const pValCol = cols.find((c: string) => 
            c === 'adj.p.hyper.enri' ||
            c.toLowerCase().includes('adj.p.hyper') ||
            c.toLowerCase().includes('p.adjust') || 
            c.toLowerCase().includes('padj') || 
            c.toLowerCase().includes('fdr') ||
            c.toLowerCase().includes('adj.p')
        );
        
        // Gene ratio: r/rExpected
        const rCol = cols.find((c: string) => c === 'r');
        const rExpectedCol = cols.find((c: string) => c === 'rExpected');
        
        // Count column for bubble size
        const countCol = cols.find((c: string) => 
            c === 'r' || // Number of genes in category
            c.toLowerCase().includes('count')
        );

        if (!descCol || !pValCol || !rCol || !rExpectedCol) {
             setError(`Missing required columns. Found: ${cols.join(', ')}. Need: term, adj.p.hyper.enri, r, rExpected`);
             return;
        }

        console.log('Columns detected:', { descCol, pValCol, rCol, rExpectedCol, countCol });
        console.log('First row sample:', rawData[0]);

        const processedData = rawData
            .map((row: any) => {
                const pval = parseFloat(row[pValCol]);
                const r = parseFloat(row[rCol]);
                const rExpected = parseFloat(row[rExpectedCol]);
                
                // Validate values
                if (isNaN(pval) || pval <= 0 || isNaN(r) || isNaN(rExpected) || rExpected === 0) {
                    return null;
                }
                
                const geneRatio = r / rExpected;
                const count = countCol && row[countCol] != null ? parseFloat(row[countCol]) : r;
                
                return {
                    name: row[descCol],
                    x: geneRatio, // r/rExpected
                    y: row[descCol],
                    size: count,
                    pvalue: pval,
                    z: count,
                    negLogP: -Math.log10(pval) // For color scale
                };
            })
            .filter((d: any) => d !== null)
            .sort((a: any, b: any) => {
                // Sort by p-value (most significant first)
                return a.pvalue - b.pvalue;
            })
            .slice(0, 20); // Top 20 most significant

        console.log('Processed enrichment data sample:', processedData.slice(0, 3));
        console.log('Total processed entries:', processedData.length);
        
        if (processedData.length === 0) {
            setError('No valid enrichment data found after processing.');
            return;
        }
        
        setData(processedData);
      } catch (err) {
        console.error('Failed to fetch enrichment data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    };

    if (dataset) {
        fetchData();
    }
  }, [dataset, comparisonName]);

  if (loading) return <div>Loading enrichment data...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  // Color scale based on -log10(p-value): gray to red gradient
  const getColor = (negLogP: number | undefined) => {
      if (!negLogP || negLogP <= 0) return '#e5e7eb'; // Light gray for invalid
      
      // Gradient from gray (not significant) to red (very significant)
      if (negLogP > 10) return '#7f1d1d'; // Very dark red - extremely significant (p < 10^-10)
      if (negLogP > 5) return '#991b1b'; // Dark red (p < 10^-5)
      if (negLogP > 3) return '#dc2626'; // Red (p < 0.001)
      if (negLogP > 2) return '#ef4444'; // Light red (p < 0.01)
      if (negLogP > 1.3) return '#f87171'; // Lighter red (p < 0.05)
      return '#9ca3af'; // Gray - not significant
  };
  
  // Get min and max negLogP for color scale
  const negLogPValues = data.map(d => d.negLogP).filter(v => v !== undefined);
  const minNegLogP = Math.min(...negLogPValues, 0);
  const maxNegLogP = Math.max(...negLogPValues, 10);

  return (
    <div className="space-y-4">
      {/* Color scale legend */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
        <h3 className="text-sm font-semibold mb-2">-log10(p-value)</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Not significant</span>
          <div className="flex-1 h-6 rounded" style={{
            background: 'linear-gradient(to right, #9ca3af, #f87171, #ef4444, #dc2626, #991b1b, #7f1d1d)'
          }}></div>
          <span className="text-xs text-gray-600">Very significant</span>
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">0</span>
          <span className="text-xs text-gray-500">1.3 (p=0.05)</span>
          <span className="text-xs text-gray-500">2 (p=0.01)</span>
          <span className="text-xs text-gray-500">3 (p=0.001)</span>
          <span className="text-xs text-gray-500">&gt;10</span>
        </div>
      </div>
      
      {/* Chart */}
      <div className="h-[800px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 250 }}>
            <CartesianGrid />
            <XAxis 
              type="number" 
              dataKey="x" 
              name="Gene Ratio" 
              label={{ value: 'Gene Ratio (r/rExpected)', position: 'bottom' }} 
            />
            <YAxis 
              type="category" 
              dataKey="y" 
              name="Pathway" 
              width={230} 
              tick={{fontSize: 11}} 
              interval={0}
            />
            <ZAxis type="number" dataKey="z" range={[50, 400]} name="Count" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                        <div className="bg-white p-2 border border-gray-200 shadow-sm rounded text-sm">
                            <p className="font-bold">{d.name}</p>
                            <p>Gene Ratio: {d.x?.toFixed(3) || 'N/A'}</p>
                            <p>adj.p.hyper.enri: {d.pvalue?.toExponential(2) || 'N/A'}</p>
                            <p>Count: {d.size ? Math.round(d.size) : 'N/A'}</p>
                            {d.negLogP && <p>-log10(p): {d.negLogP.toFixed(2)}</p>}
                        </div>
                    );
                }
                return null;
            }} />
            <Scatter name="Pathways" data={data}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.negLogP)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
