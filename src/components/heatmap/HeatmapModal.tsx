'use client';

import { X } from 'lucide-react';
import { useEffect } from 'react';
import HeatmapVisualization from './HeatmapVisualization';
import { HeatmapData } from './types';
import { MODAL_HEATMAP_CONFIG } from './heatmapConfig';

interface HeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  plotData: HeatmapData;
  geneMetadata: Map<string, { logFC: number; padj: number }>;
  title?: string;
}

export default function HeatmapModal({
  isOpen,
  onClose,
  plotData,
  geneMetadata,
  title,
}: HeatmapModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      {/* Modal Container */}
      <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">
            {title || 'Expression Heatmap - Plein écran'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-full hover:text-gray-900 transition-colors"
            title="Fermer (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Heatmap */}
        <div className="flex-1 p-6 overflow-auto">
          <div style={{ height: `${MODAL_HEATMAP_CONFIG.height}px` }}>
            <HeatmapVisualization
              plotData={plotData}
              config={MODAL_HEATMAP_CONFIG}
              geneMetadata={geneMetadata}
              title=""
              showSidebar={true}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
          <p>
            💡 Utilisez les contrôles Plotly pour zoomer, déplacer ou sauvegarder l'image. 
            Appuyez sur <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">ESC</kbd> pour fermer.
          </p>
        </div>
      </div>
    </div>
  );
}
