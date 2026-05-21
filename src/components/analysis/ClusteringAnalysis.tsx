'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import api from '@/utils/api';
import { Settings, Play, Download, Maximize2, Loader2, AlertCircle, Search, ChevronUp } from 'lucide-react';
import { PlotData, Layout } from 'plotly.js';
import { getColorscale } from '@/components/heatmap/heatmapConfig';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts';

// Dynamically import Plotly (SSR not supported)
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ClusteringAnalysisProps {
  projectId: string;
  datasetId: string;
  datasetName: string;
}

interface ClusteringParams {
  top_n_genes: number;
  cluster_rows: boolean;
  cluster_cols: boolean;
  method: string;
  metric: string;
  n_clusters?: number;
}

interface SilhouettePoint {
  k: number;
  silhouette_score: number;
  inertia: number;
}

interface SilhouetteResult {
  profile: SilhouettePoint[];
  recommended_k: number;
  recommended_score: number;
}

interface ClusteringResult {
  row_labels: string[];
  col_labels: string[];
  z: number[][]; // Raw data [rows][cols]
  row_order: number[];
  col_order: number[];
  row_dendrogram?: number[][];
  col_dendrogram?: number[][];
}

export default function ClusteringAnalysis({ projectId, datasetId, datasetName }: ClusteringAnalysisProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClusteringResult | null>(null);
  
  const [params, setParams] = useState<ClusteringParams>({
    top_n_genes: 500,
    cluster_rows: true,
    cluster_cols: true,
    method: 'ward',
    metric: 'euclidean'
  });

  const [plotHeight, setPlotHeight] = useState(800);
  const [colorblindMode, setColorblindMode] = useState(false);

  // Silhouette / K-means
  const [silhouetteData, setSilhouetteData] = useState<SilhouetteResult | null>(null);
  const [loadingSilhouette, setLoadingSilhouette] = useState(false);
  const [silhouetteError, setSilhouetteError] = useState<string | null>(null);
  const [showSilhouette, setShowSilhouette] = useState(false);

  const fetchSilhouette = async () => {
    setLoadingSilhouette(true);
    setSilhouetteError(null);
    setShowSilhouette(true);
    try {
      const response = await api.get(`/datasets/${datasetId}/clustering-quality`, {
        params: { top_n_genes: params.top_n_genes, metric: params.metric, k_min: 2, k_max: 10 }
      });
      setSilhouetteData(response.data);
    } catch (err: any) {
      setSilhouetteError(err.response?.data?.detail || 'Failed to compute silhouette scores');
    } finally {
      setLoadingSilhouette(false);
    }
  };

  const applyRecommendedK = (k: number) => {
    const newParams = { ...params, method: 'kmeans', n_clusters: k };
    setParams(newParams);
    runClustering(newParams);
  };

  const runClustering = async (overrideParams?: Partial<ClusteringParams>) => {
    setLoading(true);
    setError(null);
    try {
      const effectiveParams = overrideParams ? { ...params, ...overrideParams } : params;
      const response = await api.post(`/datasets/${datasetId}/cluster`, effectiveParams);
      setResult(response.data);
    } catch (err: any) {
      console.error("Clustering error:", err);
      setError(err.response?.data?.detail || "Failed to perform clustering");
    } finally {
      setLoading(false);
    }
  };

  // Initial run
  useEffect(() => {
    runClustering();
  }, [datasetId]);

  // Construct Plotly Data
  const plotData = useMemo(() => {
    if (!result) return null;

    // Reorder data based on clustering result
    // result.z is list of rows (genes).
    // We want to reorder rows by row_order and cols by col_order.
    
    // 1. Reorder Rows
    const orderedRows = result.row_order.map(i => result.z[i]);
    const orderedRowLabels = result.row_order.map(i => result.row_labels[i]);

    // 2. Reorder Cols (within each row)
    const finalZ = orderedRows.map(row => result.col_order.map(j => row[j]));
    const orderedColLabels = result.col_order.map(j => result.col_labels[j]);

    const heatmapTrace: Partial<PlotData> = {
      type: 'heatmap',
      z: finalZ,
      x: orderedColLabels,
      y: orderedRowLabels,
      colorscale: getColorscale(colorblindMode),
      reversescale: true, // Red usually up/hot
      // zmid: 0, // Assuming centered data often, but maybe not? 
      // Actually standard count matrices are not centered.
      // We might need an option to standardize rows (Z-score) in frontend or backend.
      // Usually clustering visualizers show Z-scores.
      // Let's implement client-side Z-score normalization for visualization if needed, 
      // or assume raw values. For raw counts, RdBu is bad. Viridis or Magma is better.
      // But usually people want Z-scores for heatmaps of expression.
      colorbar: {
        title: { text: 'Value' },
        thickness: 20
      }
    };

    return [heatmapTrace];
  }, [result]);

  // If showing Z-scores is critical (it is for expression heatmaps),
  // we should probably normalize in the backend or frontend.
  // Backend is safer for performance.
  // Let's add a "Standardize Rows" toggle to UI, but strictly speaking 
  // calculating Z-scores on 1000 genes x 50 samples is fast in JS too.
  
  // Z-score transform helper
  const zScoreTransform = (data: number[][]): number[][] => {
      return data.map(row => {
          const mean = row.reduce((a, b) => a + b, 0) / row.length;
          const std = Math.sqrt(row.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / row.length) || 1;
          return row.map(v => (v - mean) / std);
      });
  };

  // Improved Plot Memo with Z-score option
  const [standardize, setStandardize] = useState(true);

  const finalPlotData = useMemo(() => {
      if (!result) return [];
      
      const processedZ = result.z;
      
      // 1. Reorder Rows first
      let orderedRows = result.row_order.map(i => processedZ[i]);
      const orderedRowLabels = result.row_order.map(i => result.row_labels[i]);
      
      // 2. Standardize if requested (Calc Z-score per row)
      if (standardize) {
          orderedRows = zScoreTransform(orderedRows);
      }

      // 3. Reorder Cols
      const finalZ = orderedRows.map(row => result.col_order.map(j => row[j]));
      const orderedColLabels = result.col_order.map(j => result.col_labels[j]);

      return [{
          type: 'heatmap',
          z: finalZ,
          x: orderedColLabels,
          y: orderedRowLabels,
          colorscale: getColorscale(colorblindMode), 
          reversescale: true,
          zmin: standardize ? -2 : undefined,
          zmax: standardize ? 2 : undefined,
          colorbar: { title: standardize ? 'Z-Score' : 'Expression' }
      } as Partial<PlotData>];

  }, [result, standardize, colorblindMode]);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header / Controls */}
      <div className="bg-white p-4 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">Hierarchical Clustering</h2>
            
            <div className="h-6 w-px bg-gray-300"></div>

            {/* Inputs */}
            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Genes:</label>
                <select 
                    value={params.top_n_genes} 
                    onChange={e => setParams({...params, top_n_genes: Number(e.target.value)})}
                    className="text-sm border rounded px-2 py-1"
                >
                    <option value="100">Top 100</option>
                    <option value="500">Top 500</option>
                    <option value="1000">Top 1000</option>
                    <option value="2000">Top 2000</option>
                    <option value="5000">Top 5000</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Metric:</label>
                <select 
                    value={params.metric} 
                    onChange={e => setParams({...params, metric: e.target.value})}
                    className="text-sm border rounded px-2 py-1"
                >
                    <option value="euclidean">Euclidean</option>
                    <option value="correlation">Correlation</option>
                    <option value="cosine">Cosine</option>
                </select>
            </div>

             <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Method:</label>
                <select
                    value={params.method}
                    onChange={e => setParams({...params, method: e.target.value})}
                    className="text-sm border rounded px-2 py-1"
                >
                    <option value="ward">Ward</option>
                    <option value="average">Average</option>
                    <option value="complete">Complete</option>
                    <option value="single">Single</option>
                    <option value="kmeans">K-means</option>
                </select>
            </div>

            {params.method === 'kmeans' && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">k:</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={params.n_clusters ?? 8}
                  onChange={e => setParams({ ...params, n_clusters: Number(e.target.value) })}
                  className="text-sm border rounded px-2 py-1 w-16"
                />
                <button
                  onClick={fetchSilhouette}
                  disabled={loadingSilhouette}
                  className="flex items-center gap-1.5 border border-gray-300 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50 disabled:opacity-50"
                  title="Compute silhouette scores to find the optimal k"
                >
                  {loadingSilhouette ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Find optimal k
                </button>
              </div>
            )}

            <button
                onClick={() => runClustering()}
                disabled={loading}
                className="flex items-center gap-2 bg-brand-primary text-white px-3 py-1.5 rounded text-sm hover:bg-brand-primary/90 disabled:opacity-50"
            >
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4"/>}
                Run
            </button>
            
            <div className="flex-grow"></div>
             
             <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                    type="checkbox"
                    checked={standardize}
                    onChange={e => setStandardize(e.target.checked)}
                    className="rounded text-brand-primary"
                />
                Scale Rows (Z-score)
            </label>

            <ColorblindToggle value={colorblindMode} onChange={setColorblindMode} />

            <AIChartAssistant
              datasetId={datasetId}
              chartType="heatmap"
              contextKey="heatmap-default"
              context={{
                n_genes: result?.row_labels?.length ?? 0,
                n_samples: result?.col_labels?.length ?? 0,
                n_clusters: params.n_clusters ?? null,
                top_varying_genes: (result?.row_labels ?? []).slice(0, 5),
                sample_groups: result?.col_labels ?? [],
                method: params.method,
              }}
              label="Heatmap"
            />

        </div>
      </div>

      {/* Silhouette Panel */}
      {showSilhouette && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Silhouette Score by k</span>
            <div className="flex items-center gap-3">
              {silhouetteData && (
                <span className="text-xs text-gray-500">
                  Recommended: <strong className="text-amber-600">k={silhouetteData.recommended_k}</strong> (score={silhouetteData.recommended_score.toFixed(3)})
                </span>
              )}
              <button onClick={() => setShowSilhouette(false)} className="text-gray-400 hover:text-gray-600">
                <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {silhouetteError && (
            <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{silhouetteError}</p>
          )}

          {loadingSilhouette && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Computing silhouette scores…
            </div>
          )}

          {silhouetteData && !loadingSilhouette && (
            <div className="flex items-end gap-6">
              <div className="flex-1" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={silhouetteData.profile} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="k" label={{ value: 'k', position: 'insideBottomRight', offset: -4 }} tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 1]} tickFormatter={v => v.toFixed(2)} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(val: number | undefined) => [val != null ? val.toFixed(4) : '—', 'Silhouette']}
                      labelFormatter={k => `k = ${k}`}
                    />
                    <ReferenceLine y={0.5} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Good threshold', position: 'right', fontSize: 11, fill: '#94a3b8' }} />
                    <Line
                      type="monotone"
                      dataKey="silhouette_score"
                      stroke="#2A2E5B"
                      strokeWidth={2}
                      dot={(props: any) => {
                        const isRec = props.payload.k === silhouetteData.recommended_k;
                        return (
                          <circle
                            key={props.index}
                            cx={props.cx}
                            cy={props.cy}
                            r={isRec ? 7 : 4}
                            fill={isRec ? '#d97706' : '#2A2E5B'}
                            stroke={isRec ? '#fff' : 'none'}
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <button
                onClick={() => applyRecommendedK(silhouetteData.recommended_k)}
                className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium mb-2"
              >
                Use k={silhouetteData.recommended_k}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 p-4 overflow-hidden relative">
          
          {loading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-primary mx-auto mb-2"/>
                      <p className="text-gray-600">Calculating clusters...</p>
                  </div>
              </div>
          )}

          {error && (
              <div className="absolute inset-x-4 top-4 bg-red-50 p-4 border border-red-200 rounded text-red-700 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5"/>
                  {error}
              </div>
          )}

          {result && (
              <div className="h-full w-full bg-white rounded-lg shadow border border-gray-200 p-2">
                   <Plot
                        data={finalPlotData}
                        layout={{
                            autosize: true,
                            margin: { t: 50, r: 50, b: 100, l: 150 }, // More space for labels
                            title: { text: `Heatmap (${result.row_labels.length} genes x ${result.col_labels.length} samples)` },
                            xaxis: { 
                                automargin: true,
                                tickangle: -45
                            },
                            yaxis: {
                                automargin: true,
                            }
                        }}
                        style={{ width: '100%', height: '100%' }}
                        useResizeHandler={true}
                        config={{ 
                            responsive: true,
                            displayModeBar: true,
                            toImageButtonOptions: {
                                format: 'svg',
                                filename: 'heatmap_clustering'
                            }
                        }}
                   />
              </div>
          )}

           {!result && !loading && !error && (
              <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                      <Settings className="h-12 w-12 mx-auto mb-2 opacity-50"/>
                      <p>Configure parameters and click Run to generate heatmap</p>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
}
