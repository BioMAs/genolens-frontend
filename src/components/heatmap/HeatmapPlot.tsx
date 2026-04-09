'use client';

import { useState, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { HeatmapPlotProps, ClusteringParams, ExportFormat } from './types';
import { DEFAULT_HEATMAP_CONFIG, DEFAULT_CLUSTERING_PARAMS, generateExportFilename } from './heatmapConfig';
import { useHeatmapData } from './useHeatmapData';
import HeatmapControls from './HeatmapControls';
import HeatmapVisualization from './HeatmapVisualization';
import HeatmapModal from './HeatmapModal';

export default function HeatmapPlot({
  degDataset,
  matrixDataset,
  sampleIds,
  comparisonName: propComparisonName,
}: HeatmapPlotProps) {
  const [params, setParams] = useState<ClusteringParams>(DEFAULT_CLUSTERING_PARAMS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const plotDivRef = useRef<HTMLDivElement | null>(null);

  const comparisonName =
    propComparisonName || degDataset.dataset_metadata?.comparison_name || degDataset.name;

  const { loading, error, plotData, geneMetadata, isPreview, refetch } = useHeatmapData({
    degDataset,
    matrixDataset,
    sampleIds,
    comparisonName,
    params,
  });

  /**
   * Handle export to PNG or SVG
   */
  const handleExport = async (format: ExportFormat) => {
    if (!plotDivRef.current || !plotData) return;

    try {
      // Dynamic import of Plotly for client-side only
      const Plotly = (await import('react-plotly.js')).default as any;
      
      // Get the main plot element
      const plotElement = plotDivRef.current.querySelector('.js-plotly-plot') as any;
      if (!plotElement) {
        console.error('Plot element not found');
        return;
      }

      const filename = generateExportFilename(comparisonName, params.top_n_genes, format);
      
      // Use Plotly.Lib to access the underlying Plotly library
      const PlotlyLib = (Plotly as any).Plotly || window.Plotly;
      if (!PlotlyLib || !PlotlyLib.downloadImage) {
        console.error('Plotly library not available');
        return;
      }
      
      const options = {
        format: format,
        width: 1600,
        height: DEFAULT_HEATMAP_CONFIG.height * 1.5,
        scale: format === 'png' ? 3 : 1, // 3x resolution for PNG (300 DPI equivalent)
        filename: filename,
      };

      await PlotlyLib.downloadImage(plotElement, options);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  };

  /**
   * Handle fullscreen modal
   */
  const handleFullscreen = () => {
    setIsModalOpen(true);
  };

  // Loading state
  if (loading && !plotData) {
    return (
      <div className="flex h-125 items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-gray-500">Generating heatmap...</span>
      </div>
    );
  }

  // Error state
  if (error && !plotData) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        <p className="font-semibold">Error</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  // No data state
  if (!plotData) {
    return null;
  }

  return (
    <>
      <div className="space-y-3">
        {/* Controls */}
        <HeatmapControls
          params={params}
          onParamsChange={setParams}
          onRefresh={refetch}
          onFullscreen={handleFullscreen}
          onExport={handleExport}
          isLoading={loading}
        />

        {/* Heatmap Container - Fixed height for card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="h-175 lg:h-175 sm:h-150 p-3">
            <HeatmapVisualization
              plotData={plotData}
              config={DEFAULT_HEATMAP_CONFIG}
              geneMetadata={geneMetadata}
              title={`Clustered Heatmap (${plotData.y.length} DEGs)`}
              showSidebar={true}
              onPlotReady={(div) => {
                plotDivRef.current = div;
              }}
            />
          </div>
        </div>

        {/* Info Banner */}
        <div className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          <p>
            💡 <strong>Tip:</strong> Genes are split into UP (overexpressed) and DOWN (underexpressed) groups.
            Use fullscreen mode for a better visualization of expression patterns.
            {loading && <span className="ml-2 text-purple-600 font-medium">⟳ Updating...</span>}
            {isPreview && !loading && (
              <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-medium">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Preview (50 genes) — loading full data…
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Fullscreen Modal */}
      <HeatmapModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        plotData={plotData}
        geneMetadata={geneMetadata}
        title={`Expression Heatmap - ${comparisonName}`}
      />
    </>
  );
}
