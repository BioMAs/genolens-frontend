'use client';

import { useEffect, useRef, useState } from 'react';

interface GSEAEnrichmentPlotProps {
  geneSetName: string;
  enrichmentScore: number;
  runningEnrichmentScores: number[];
  genePositions: number[];
  rankedGenes: string[];
  metrics: number[];
  geneSetSize: number;
}

export default function GSEAEnrichmentPlot({
  geneSetName,
  enrichmentScore,
  runningEnrichmentScores,
  genePositions,
  rankedGenes,
  metrics,
  geneSetSize
}: GSEAEnrichmentPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredGene, setHoveredGene] = useState<{ gene: string; metric: number } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate plot dimensions
    const margin = { top: 40, right: 40, bottom: 80, left: 60 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    // Find min/max for scaling
    const minES = Math.min(...runningEnrichmentScores);
    const maxES = Math.max(...runningEnrichmentScores);
    const esRange = maxES - minES;

    // Scale functions
    const xScale = (i: number) => margin.left + (i / rankedGenes.length) * plotWidth;
    const yScale = (es: number) => margin.top + plotHeight - ((es - minES) / esRange) * plotHeight;

    // Draw background
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(margin.left, margin.top, plotWidth, plotHeight);

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (plotHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotWidth, y);
      ctx.stroke();
    }

    // Draw zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(margin.left + plotWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw running enrichment score line
    ctx.strokeStyle = enrichmentScore > 0 ? '#dc2626' : '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    runningEnrichmentScores.forEach((es, i) => {
      const x = xScale(i);
      const y = yScale(es);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw gene position ticks
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    genePositions.forEach(pos => {
      const x = xScale(pos);
      ctx.beginPath();
      ctx.moveTo(x, margin.top + plotHeight);
      ctx.lineTo(x, margin.top + plotHeight + 10);
      ctx.stroke();
    });

    // Draw axes
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.stroke();
    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();

    // Draw Y-axis labels
    ctx.fillStyle = '#000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const value = minES + (esRange * i) / 5;
      const y = margin.top + plotHeight - (plotHeight * i) / 5;
      ctx.fillText(value.toFixed(2), margin.left - 10, y);
    }

    // Draw Y-axis title
    ctx.save();
    ctx.translate(20, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Enrichment Score (ES)', 0, 0);
    ctx.restore();

    // Draw X-axis title
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Rank in Ordered Dataset', margin.left + plotWidth / 2, height - 30);

    // Draw X-axis tick labels
    ctx.font = '12px sans-serif';
    ctx.fillText('0', margin.left, height - 50);
    ctx.fillText(rankedGenes.length.toString(), margin.left + plotWidth, height - 50);
    ctx.fillText((rankedGenes.length / 2).toFixed(0), margin.left + plotWidth / 2, height - 50);

    // Draw title
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(geneSetName, width / 2, 20);

    // Draw ES value
    ctx.font = '12px sans-serif';
    ctx.fillText(`ES = ${enrichmentScore.toFixed(3)}`, width / 2, height - 10);

  }, [geneSetName, enrichmentScore, runningEnrichmentScores, genePositions, rankedGenes, metrics, geneSetSize]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate margins (must match drawing logic)
    const margin = { top: 40, right: 40, bottom: 80, left: 60 };
    const plotWidth = canvas.width - margin.left - margin.right;

    // Check if mouse is in plot area
    if (x < margin.left || x > margin.left + plotWidth) {
      setHoveredGene(null);
      return;
    }

    // Find closest gene position
    const relativeX = x - margin.left;
    const geneIndex = Math.round((relativeX / plotWidth) * rankedGenes.length);

    if (geneIndex >= 0 && geneIndex < rankedGenes.length) {
      setHoveredGene({
        gene: rankedGenes[geneIndex],
        metric: metrics[geneIndex]
      });
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="border border-gray-300 rounded-lg bg-white cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredGene(null)}
      />

      {/* Tooltip */}
      {hoveredGene && (
        <div className="absolute top-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-3 text-sm">
          <div className="font-semibold">{hoveredGene.gene}</div>
          <div className="text-gray-600">Metric: {hoveredGene.metric.toFixed(3)}</div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-red-600"></div>
          <span>Positive Enrichment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-blue-600"></div>
          <span>Negative Enrichment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-gray-600" style={{ borderTop: '2px dashed' }}></div>
          <span>Zero Line</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-3 border-b-2 border-gray-900"></div>
          <span>Gene Set Hits ({geneSetSize})</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <p className="font-semibold mb-2">How to interpret this plot:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>The line shows the running enrichment score across all ranked genes</li>
          <li>Vertical ticks at the bottom mark where gene set members appear in the ranking</li>
          <li>Peak (or valley) indicates maximum enrichment</li>
          <li>Genes before the peak contribute to the leading edge</li>
          <li>Positive ES = enriched in upregulated genes; Negative ES = enriched in downregulated genes</li>
        </ul>
      </div>
    </div>
  );
}
