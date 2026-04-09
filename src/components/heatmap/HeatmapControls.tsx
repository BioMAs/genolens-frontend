'use client';

import { ChevronDown, RefreshCw, Maximize2, Download, Settings2 } from 'lucide-react';
import { ClusteringParams, ExportFormat } from './types';
import { TOP_N_OPTIONS } from './heatmapConfig';
import { useState } from 'react';

interface HeatmapControlsProps {
  params: ClusteringParams;
  onParamsChange: (params: ClusteringParams) => void;
  onRefresh: () => void;
  onFullscreen: () => void;
  onExport: (format: ExportFormat) => void;
  isLoading?: boolean;
}

export default function HeatmapControls({
  params,
  onParamsChange,
  onRefresh,
  onFullscreen,
  onExport,
  isLoading = false,
}: HeatmapControlsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const selectedOption = TOP_N_OPTIONS.find((opt) => opt.value === params.top_n_genes);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Main Controls */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <h3 className="font-semibold text-gray-800 text-sm">
            Expression Heatmap
          </h3>

          {/* Top N Genes Selector */}
          <div className="relative">
            <select
              value={params.top_n_genes}
              onChange={(e) =>
                onParamsChange({ ...params, top_n_genes: parseInt(e.target.value) })
              }
              disabled={isLoading}
              className="text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-gray-50 pr-8 pl-3 py-1.5 appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedOption?.description}
            >
              {TOP_N_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} title={option.description}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Advanced Settings Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-purple-600 px-2 py-1 rounded hover:bg-gray-50 transition-colors"
            title="Paramètres avancés"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Avancé</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Export Button with Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isLoading}
              className="p-2 text-gray-600 hover:bg-gray-50 rounded-md hover:text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exporter la heatmap"
            >
              <Download className="w-4 h-4" />
            </button>
            
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                  <button
                    onClick={() => {
                      onExport('png');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                  >
                    Export PNG
                  </button>
                  <button
                    onClick={() => {
                      onExport('svg');
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-600"
                  >
                    Export SVG
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={onFullscreen}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-md hover:text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Afficher en plein écran"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-md hover:text-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Clustering Method */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Méthode de clustering
              </label>
              <select
                value={params.method}
                onChange={(e) => {
                  const newMethod = e.target.value;
                  // Ward nécessite euclidean - ajuster automatiquement
                  if (newMethod === 'ward' && params.metric !== 'euclidean') {
                    onParamsChange({ ...params, method: newMethod, metric: 'euclidean' });
                  } else {
                    onParamsChange({ ...params, method: newMethod });
                  }
                }}
                disabled={isLoading}
                className="w-full text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
              >
                <optgroup label="Hiérarchique">
                  <option value="ward">Ward (Euclidean uniquement)</option>
                  <option value="complete">Complete</option>
                  <option value="average">Average</option>
                  <option value="single">Single</option>
                </optgroup>
                <optgroup label="Partitionnement">
                  <option value="kmeans">K-means</option>
                </optgroup>
              </select>
            </div>

            {/* Distance Metric */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Métrique de distance
              </label>
              <select
                value={params.metric}
                onChange={(e) => onParamsChange({ ...params, metric: e.target.value })}
                disabled={isLoading || params.method === 'ward' || params.method === 'kmeans'}
                className="w-full text-sm border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50"
                title={
                  params.method === 'ward' 
                    ? 'Ward nécessite la métrique Euclidean'
                    : params.method === 'kmeans'
                    ? 'K-means utilise toujours Euclidean'
                    : ''
                }
              >
                <option value="euclidean">Euclidean (L2)</option>
                <option value="manhattan">Manhattan (L1)</option>
                <option value="correlation">Correlation (Pearson)</option>
                <option value="cosine">Cosine</option>
              </select>
            </div>

            {/* Clustering Options */}
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-medium text-gray-700">
                Options de clustering
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={params.cluster_rows}
                  onChange={(e) =>
                    onParamsChange({ ...params, cluster_rows: e.target.checked })
                  }
                  disabled={isLoading}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
                <span className="text-xs">Clustering gènes</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={params.cluster_cols}
                  onChange={(e) =>
                    onParamsChange({ ...params, cluster_cols: e.target.checked })
                  }
                  disabled={isLoading}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                />
                <span className="text-xs">Clustering échantillons</span>
              </label>
            </div>
          </div>

          {selectedOption && (
            <div className="mt-3 text-xs text-gray-600 italic">
              💡 {selectedOption.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
