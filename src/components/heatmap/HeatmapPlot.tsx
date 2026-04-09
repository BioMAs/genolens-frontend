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

  const { loading, error, plotData, geneMetadata, refetch } = useHeatmapData({
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
      alert('Échec de l\'export. Veuillez réessayer.');
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
        <span className="ml-2 text-gray-500">Génération de la heatmap...</span>
      </div>
    );
  }

  // Error state
  if (error && !plotData) {
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        <p className="font-semibold">Erreur</p>
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
            💡 <strong>Astuce :</strong> Les gènes sont séparés en groupes UP (sur-exprimés) et DOWN (sous-exprimés).
            Utilisez le mode plein écran pour une meilleure visualisation des patterns d'expression.
            {loading && <span className="ml-2 text-purple-600 font-medium">⟳ Mise à jour en cours...</span>}
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
