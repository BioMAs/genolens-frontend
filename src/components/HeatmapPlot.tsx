'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { Loader2, RefreshCw, ZoomIn, Settings2 } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface HeatmapPlotProps {
  degDataset: Dataset;
  matrixDataset: Dataset;
  sampleIds?: string[];
  comparisonName?: string;
}

interface ClusteringParams {
  top_n_genes: number;
  method: string;
  metric: string;
  cluster_rows: boolean;
  cluster_cols: boolean;
}

export default function HeatmapPlot({ degDataset, matrixDataset, sampleIds, comparisonName: propComparisonName }: HeatmapPlotProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plotData, setPlotData] = useState<any>(null);
  
  // Clustering params
  // const [useClustering, setUseClustering] = useState(false); // Deprecated
  const [params, setParams] = useState<ClusteringParams>({
    top_n_genes: 100, // Default to 100
    method: 'ward',
    metric: 'euclidean',
    cluster_rows: true,
    cluster_cols: true
  });

  const comparisonName = propComparisonName || degDataset.dataset_metadata?.comparison_name || degDataset.name;

  useEffect(() => {
    fetchHeatmapData();
  }, [degDataset, matrixDataset, sampleIds, comparisonName, params]);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      setError(null);

        // --- UNIFIED CLUSTERING MODE ---
        // 1. First ensure we have gene IDs if not in "top variance" mode
        // For now, always use DEGs as input for clustering unless switched to "All Varied" (future feature)
        
        let targetGenes: string[] | undefined = undefined;
        let degRows: any[] = [];
        let significant: any[] = [];

        // Fetch Top DEGs to cluster them
        const columnsInfo = degDataset.dataset_metadata?.columns_info?.comparisons?.[comparisonName] || 
                            degDataset.dataset_metadata?.comparisons?.[comparisonName];
                            
        if (columnsInfo) {
            const pValCol = columnsInfo.padj;
            const logFCCol = columnsInfo.logFC;
            
            // Fetch significant genes
            const degResponse = await api.post(`/datasets/${degDataset.id}/query`, {
              limit: 10000 
            });
            
            degRows = degResponse.data.data;
            
            // Filter significant
            significant = degRows.filter((r: any) => {
                const padj = parseFloat(r[pValCol]);
                const logFC = parseFloat(r[logFCCol]);
                return padj < 0.05 && Math.abs(logFC) > 1.0; 
            }).sort((a: any, b: any) => parseFloat(b[logFCCol]) - parseFloat(a[logFCCol])); 
            
            // Take all significant genes (up to 2000 for safety, but effectively "all" for most experiments)
            // If the user wants "TOUT", we try to give them as many as reasonable without crashing browser.
            // Let's cap at 5000 if they select "All"
            
            if (params.top_n_genes === 0) {
               targetGenes = significant.map((r: any) => r['gene_id']); // No limit (except memory)
            } else {
               targetGenes = significant.slice(0, params.top_n_genes).map((r: any) => r['gene_id']);
            }
        }
        
        // If we found DEGs, split them into UP and DOWN for separate clustering
        // This guarantees the visual "grouping" the user requested.
        let upGenes: string[] = [];
        let downGenes: string[] = [];
        
        if (targetGenes) {
            upGenes = significant
                .filter((r: any) => parseFloat(r[columnsInfo?.logFC || '']) > 0)
                .slice(0, Math.ceil(params.top_n_genes / 2) + 1000) // generous buffer
                .map((r: any) => r['gene_id']);
                
            downGenes = significant
                .filter((r: any) => parseFloat(r[columnsInfo?.logFC || '']) < 0)
                .slice(0, Math.ceil(params.top_n_genes / 2) + 1000)
                .map((r: any) => r['gene_id']);

            // Limit total count to requested top_n_genes while preserving balance or just taking top of each
            // Simple slice to fit total limit approximately
            const limit = params.top_n_genes;
            // logic: take top N/2 from each if available
            if (upGenes.length + downGenes.length > limit) {
                upGenes = upGenes.slice(0, limit / 2);
                downGenes = downGenes.slice(0, limit / 2);
            }
        }

        if (upGenes.length === 0 && downGenes.length === 0) {
             setError("No significant DEGs found.");
             setLoading(false);
             return;
        }

        // 2. Request Clustering from Backend (Split Strategy)
        // We run two clustering jobs in parallel for better visual separation
        const [upResult, downResult] = await Promise.all([
             upGenes.length > 0 ? api.post(`/datasets/${matrixDataset.id}/cluster`, { ...params, gene_ids: upGenes, top_n_genes: upGenes.length }) : Promise.resolve({ data: null }),
             downGenes.length > 0 ? api.post(`/datasets/${matrixDataset.id}/cluster`, { ...params, gene_ids: downGenes, top_n_genes: downGenes.length }) : Promise.resolve({ data: null })
        ]);

        // 3. Merge Results
        // We need to combine rows. Columns (samples) should ideally be consistent. 
        // Let's take the Sample order from the first valid result
        const primaryResult = upResult.data || downResult.data;
        if (!primaryResult) return;
        
        const colOrder = primaryResult.col_order;
        const colLabels = primaryResult.col_labels; // Samples sorted by that clustering

        // Helper to process a result chunk
        const processChunk = (res: any) => {
             if (!res || !res.data) return { z: [], y: [] };
             
             // Reorder columns to match primary result (critical for alignment)
             const currentCols = res.col_labels; // [SampleA, SampleB, ...]
             const primaryColLabels = colOrder.map((i: number) => colLabels[i]);
             
             // Map: "SampleX" -> current_idx_in_res
             const colMap = new Map();
             currentCols.forEach((c: string, i: number) => colMap.set(c, i));
             
             // New indices for this chunk's rows to match primary order
             // For each target column name, find where it is in THIS result
             const alignIndices = primaryColLabels.map((name: string) => colMap.get(name));

             const z = res.data;
             const y = res.row_labels;
             const row_order = res.row_order;
             
             // Ordered rows (z) aligned to primary columns
             const alignedRows = row_order.map((i: number) => {
                 // For row i, grab columns in order of alignIndices
                 return alignIndices.map((j: number) => z[i][j]);
             });
             
             const orderedY = row_order.map((i: number) => y[i]);
             
             return { z: alignedRows, y: orderedY };
        };

        const upData = processChunk(upResult.data);
        const downData = processChunk(downResult.data);
        
        // Concatenate: UP genes first, then DOWN genes
        const finalZRaw = [...upData.z, ...downData.z];
        const finalY = [...upData.y, ...downData.y];
        const finalX = colOrder.map((i: number) => colLabels[i]);

        // Compute Normalized Relative Expression (-1 to 1) row by row
        // Instead of Z-score, we center to mean (LogFC vs average) and scale by MaxAbs to range [-1, 1]
        const orderedZ = finalZRaw.map((row: number[]) => {
            const mean = row.reduce((a, b) => a + b, 0) / row.length;
            const centered = row.map(v => v - mean);
            const maxAbs = Math.max(...centered.map(Math.abs)) || 1; // Avoid div by zero
            return centered.map(v => v / maxAbs);
        });

        // Add LogFC annotation bar
        const geneLogFCMap = new Map();
        if (targetGenes && columnsInfo) {
             degRows.forEach((r:any) => geneLogFCMap.set(r['gene_id'], parseFloat(r[columnsInfo.logFC])));
        }
        const logFCs = finalY.map((gene: string) => geneLogFCMap.get(gene) || 0);

        setPlotData({
            z: orderedZ,
            x: finalX,
            y: finalY,
            logFCs: logFCs, 
            type: 'clustering'
        });

    } catch (err: any) {
      console.error("Heatmap error:", err);
      setError(err.message || "Failed to load heatmap");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
      <div className="flex h-64 items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <span className="ml-2 text-gray-500">Generating Heatmap...</span>
      </div>
  );

  if (error) return (
      <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
          {error}
      </div>
  );

  if (!plotData) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <ZoomIn className="w-4 h-4 text-purple-600"/>
                Expression Heatmap (Clustered DEGs)
            </h3>
            
            <select 
                value={params.top_n_genes}
                onChange={(e) => setParams({...params, top_n_genes: parseInt(e.target.value)})}
                className="text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-gray-50"
            >
                <option value="50">Top 50 Genes</option>
                <option value="100">Top 100 Genes</option>
                <option value="500">Top 500 Genes</option>
                <option value="1000">Top 1000 Genes</option>
                <option value="2000">Top 2000 Genes</option>
                <option value="5000">All DEGs (Max 5000)</option>
            </select>
        </div>
        <button onClick={fetchHeatmapData} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full" title="Refresh">
            <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow-sm min-h-125 flex">
        {plotData && (
             <>
             {/* Main Heatmap */}
             <div className="flex-1 h-150">
             <Plot
                data={[
                {
                    z: plotData.z,
                    x: plotData.x,
                    y: plotData.y,
                    type: 'heatmap',
                    colorscale: 'RdBu',
                    reversescale: true,
                    zmin: -1, 
                    zmax: 1,
                    showscale: true,
                    colorbar: {
                        title: 'Rel. Expr',
                        thickness: 15,
                        len: 0.5,
                        x: 1.1 // Move main colorbar right
                    }
                }
                ]}
                layout={{
                    autosize: true,
                    margin: { l: 0, r: 0, b: 100, t: 50 }, // Reduced margins
                    xaxis: { 
                        tickangle: -45,
                        side: 'bottom'
                    },
                    yaxis: {
                        autorange: 'reversed',
                        showticklabels: false, 
                        ticks: '' 
                    },
                    title: `Clustered Heatmap (${params.top_n_genes === 5000 ? 'All' : 'Top ' + params.top_n_genes} DEGs)`
                }}
                useResizeHandler={true}
                className="w-full h-full"
                config={{displayModeBar: true}}
            />
            </div>
            
            {/* Side Bar for LogFC */}
             <div className="w-16 h-150 ml-1">
                <Plot 
                    data={[{
                        z: plotData.logFCs.map((v: number) => [v]), // Column vector
                        x: ['LogFC'],
                        y: plotData.y,
                        type: 'heatmap',
                        colorscale: 'PiYG', // Pink-Green for LogFC usually good, or RdBu
                        showscale: false, // Don't show scale for this thin strip to save space
                        zmin: -2,
                        zmax: 2
                    }]}
                    layout={{
                         autosize: true,
                         margin: { l: 0, r: 0, b: 100, t: 50 },
                         xaxis: { side: 'top', tickangle: -90 },
                         yaxis: { autorange: 'reversed', showticklabels: false, ticks: '' },
                         title: 'LFC'
                    }}
                    useResizeHandler={true}
                    className="w-full h-full"
                    config={{displayModeBar: false, staticPlot: true}} // Static
                />
             </div>
             </>
        )}
      </div>
    </div>
  );
}

