'use client';

import { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useVolcanoPlot } from '@/hooks/useVisualizations';
import type { VolcanoPoint } from '@/utils/volcano';
import { Dataset } from '@/types';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

interface VolcanoPlotProps {
  dataset: Dataset;
  comparisonName: string;
}

export default function VolcanoPlot({ dataset, comparisonName }: VolcanoPlotProps) {
  // Threshold controls
  const [padjThreshold, setPadjThreshold] = useState(0.05);
  const [logfcThreshold, setLogfcThreshold] = useState(0.58);
  const [showControls, setShowControls] = useState(false);
  const [colorblindMode, setColorblindMode] = useState(false);
  const palette = getPalette(colorblindMode ? 'colorblind' : 'standard');

  // Utilise React Query pour gérer le cache et les requêtes
  const { data: volcanoData, isLoading, error, isFetching } = useVolcanoPlot(
    dataset.id,
    comparisonName,
    { 
      top_n: 5000,
      padj_threshold: padjThreshold,
      logfc_threshold: logfcThreshold
    }
  );

  const data: VolcanoPoint[] = volcanoData?.points ?? [];
  const totalGenes = volcanoData?.total_genes || 0;
  const significantGenes = volcanoData?.significant_genes || 0;
  const isCached = volcanoData?.cached || false;

  if (isLoading) return <div className="p-8 text-center text-gray-500">Loading plot data...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Failed to load data.</div>;

  return (
    <div className="w-full">
      {/* Controls */}
      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-semibold text-gray-700">Volcano Plot</h3>
            {isFetching && (
              <span className="text-xs text-purple-600 animate-pulse">⚡ Loading...</span>
            )}
            {isCached && !isFetching && (
              <span className="text-xs text-green-600">✓ Cached</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ColorblindToggle value={colorblindMode} onChange={setColorblindMode} />
            <button
              onClick={() => setShowControls(!showControls)}
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              {showControls ? '− Hide' : '+ Threshold Settings'}
            </button>
          </div>
        </div>

        {showControls && (
          <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                P-adj Threshold
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={padjThreshold}
                onChange={(e) => setPadjThreshold(parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 0.05</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                |Log2FC| Threshold
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={logfcThreshold}
                onChange={(e) => setLogfcThreshold(parseFloat(e.target.value))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 0.58 (≈1.5x)</p>
            </div>
          </div>
        )}
      </div>

      {/* Ask AI assistant — below controls */}
      <AIChartAssistant
        datasetId={dataset.id}
        chartType="volcano"
        contextKey={comparisonName}
        context={{
          comparison_name: comparisonName,
          up_count: data.filter((p) => p.is_significant && p.x > 0).length,
          down_count: data.filter((p) => p.is_significant && p.x < 0).length,
          top_up_genes: data
            .filter((p) => p.is_significant && p.x > 0)
            .slice(0, 5)
            .map((p) => ({ gene_id: p.gene, log_fc: p.x })),
          top_down_genes: data
            .filter((p) => p.is_significant && p.x < 0)
            .slice(0, 5)
            .map((p) => ({ gene_id: p.gene, log_fc: p.x })),
        }}
        label="Volcano Plot"
        panelClassName="max-h-[500px]"
      />

      {/* Plot */}
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
            <ReferenceLine x={logfcThreshold} stroke="#fbbf24" strokeDasharray="2 2" />
            <ReferenceLine x={-logfcThreshold} stroke="#fbbf24" strokeDasharray="2 2" />
            <ReferenceLine y={-Math.log10(padjThreshold)} stroke="#fbbf24" strokeDasharray="2 2" label={`p=${padjThreshold}`} />
            <Scatter name="Genes" data={data} fill="#8884d8" shape={(props: any) => <circle cx={props.cx} cy={props.cy} r={1} fill={props.fill} fillOpacity={0.8} />}>
              {data.map((entry, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.is_significant ? (entry.x > 0 ? palette.up : palette.down) : palette.ns} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      
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
                <div className="w-6 h-6 rounded mr-1.5" style={{ backgroundColor: palette.up }}></div>
                <span className="text-sm text-gray-600">Upregulated</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded mr-1.5" style={{ backgroundColor: palette.down }}></div>
                <span className="text-sm text-gray-600">Downregulated</span>
              </div>
              <div className="flex items-center">
                <div className="w-6 h-6 rounded mr-1.5" style={{ backgroundColor: palette.ns }}></div>
                <span className="text-sm text-gray-600">Not Significant</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center">
          Significant: padj &lt; {padjThreshold} and |log2FC| &gt; {logfcThreshold.toFixed(2)}
        </p>
      </div>
    </div>
  );
}
