'use client';

import { useEffect, useRef, useState } from 'react';
import { useChartTheme } from '@/utils/chartTheme';

interface GSEAEnrichmentPlotProps {
  geneSetName: string;
  enrichmentScore: number;
  runningEnrichmentScores: number[];
  genePositions: number[];
  rankedGenes: string[];
  metrics: number[];
  geneSetSize: number;
}

/** Height follows the width — a wide plot stays legible, a phone plot is not 500px of strip. */
const MIN_HEIGHT = 300;
const MAX_HEIGHT = 500;
const ASPECT = 0.62;

/** Narrow plots give the axis less room: at 340px, a 60px left margin is a fifth of the plot. */
function marginsFor(width: number) {
  return width < 480
    ? { top: 32, right: 16, bottom: 64, left: 44 }
    : { top: 40, right: 40, bottom: 80, left: 60 };
}

/**
 * The running enrichment score of one gene set.
 *
 * A canvas that was 800×500 device pixels whatever its container: it overflowed every phone and
 * half a tablet, drew blurry on a Retina screen, and painted black text on a light-grey plate —
 * unreadable once the app was in its dark theme. It now measures its container, draws at the
 * device pixel ratio, and takes its inks from the resolved chart theme.
 */
export default function GSEAEnrichmentPlot({
  geneSetName,
  enrichmentScore,
  runningEnrichmentScores,
  genePositions,
  rankedGenes,
  metrics,
  geneSetSize
}: GSEAEnrichmentPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useChartTheme();
  const [width, setWidth] = useState(800);
  const [hoveredGene, setHoveredGene] = useState<{ gene: string; metric: number } | null>(null);

  const height = Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, width * ASPECT)));

  // Track the container's width. Rounded, so sub-pixel jitter does not redraw in a loop.
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Back the canvas at device resolution, then draw in CSS pixels.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const margin = marginsFor(width);
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const compact = width < 480;
    const font = (size: number, weight = 400) => `${weight} ${size}px ${theme.fontFamily}`;

    // Find min/max for scaling
    const minES = Math.min(...runningEnrichmentScores, 0);
    const maxES = Math.max(...runningEnrichmentScores, 0);
    const esRange = maxES - minES || 1;

    // Scale functions
    const xScale = (i: number) => margin.left + (i / Math.max(1, rankedGenes.length)) * plotWidth;
    const yScale = (es: number) => margin.top + plotHeight - ((es - minES) / esRange) * plotHeight;

    // Grid lines
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (plotHeight * i) / 5;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + plotWidth, y);
      ctx.stroke();
    }

    // Zero line
    const zeroY = yScale(0);
    ctx.strokeStyle = theme.zero;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(margin.left + plotWidth, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Running enrichment score: the regulation direction it reports, in the app's own colours.
    ctx.strokeStyle = enrichmentScore > 0 ? theme.up : theme.down;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    runningEnrichmentScores.forEach((es, i) => {
      const x = xScale(i);
      const y = yScale(es);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gene set hits
    ctx.strokeStyle = theme.inkMuted;
    ctx.lineWidth = 1;
    genePositions.forEach((pos) => {
      const x = xScale(pos);
      ctx.beginPath();
      ctx.moveTo(x, margin.top + plotHeight);
      ctx.lineTo(x, margin.top + plotHeight + 10);
      ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = theme.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, margin.top + plotHeight);
    ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = theme.inkMuted;
    ctx.font = font(compact ? 10 : 11);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
      const value = minES + (esRange * i) / 5;
      const y = margin.top + plotHeight - (plotHeight * i) / 5;
      ctx.fillText(value.toFixed(2), margin.left - 8, y);
    }

    // Y-axis title
    ctx.save();
    ctx.translate(compact ? 10 : 16, margin.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.ink;
    ctx.font = font(compact ? 11 : 12, 600);
    ctx.fillText(compact ? 'ES' : 'Enrichment Score (ES)', 0, 0);
    ctx.restore();

    // X-axis tick labels and title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = theme.inkMuted;
    ctx.font = font(compact ? 10 : 11);
    const tickY = margin.top + plotHeight + 26;
    ctx.fillText('0', margin.left, tickY);
    ctx.fillText((rankedGenes.length / 2).toFixed(0), margin.left + plotWidth / 2, tickY);
    ctx.fillText(rankedGenes.length.toString(), margin.left + plotWidth, tickY);

    ctx.fillStyle = theme.ink;
    ctx.font = font(compact ? 11 : 12, 600);
    ctx.fillText('Rank in ordered dataset', margin.left + plotWidth / 2, tickY + 20);

    // Title, cut to the plot width rather than spilling past the canvas edge
    ctx.font = font(compact ? 12 : 14, 600);
    let title = geneSetName;
    while (title.length > 4 && ctx.measureText(title).width > width - 16) {
      title = `${title.slice(0, -2)}…`;
    }
    ctx.fillText(title, width / 2, compact ? 18 : 22);

    // ES value
    ctx.fillStyle = theme.inkMuted;
    ctx.font = font(compact ? 10 : 11);
    ctx.fillText(`ES = ${enrichmentScore.toFixed(3)}`, width / 2, height - 6);
  }, [width, height, theme, geneSetName, enrichmentScore, runningEnrichmentScores, genePositions, rankedGenes]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // CSS pixels on both sides — the backing store is `width × dpr`, which the old code compared
    // against the pointer and so picked the wrong gene on any scaled canvas.
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const margin = marginsFor(width);
    const plotWidth = width - margin.left - margin.right;

    if (x < margin.left || x > margin.left + plotWidth) {
      setHoveredGene(null);
      return;
    }

    const geneIndex = Math.round(((x - margin.left) / plotWidth) * rankedGenes.length);
    if (geneIndex >= 0 && geneIndex < rankedGenes.length) {
      setHoveredGene({ gene: rankedGenes[geneIndex], metric: metrics[geneIndex] });
    }
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Running enrichment score for ${geneSetName}: ES ${enrichmentScore.toFixed(3)}, ${geneSetSize} genes in the set across ${rankedGenes.length} ranked genes.`}
          style={{ width: '100%', height }}
          className="block cursor-crosshair rounded-control bg-surface"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredGene(null)}
        />
      </div>

      {/* Tooltip */}
      {hoveredGene && (
        <div className="absolute top-4 right-4 bg-raised rounded-card shadow-elev-2 p-3 text-body-sm">
          <div className="font-semibold">{hoveredGene.gene}</div>
          <div className="text-secondary">Metric: {hoveredGene.metric.toFixed(3)}</div>
        </div>
      )}

      {/* Legend — wraps on a phone instead of running off the card */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-body-sm">
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 bg-up"></div>
          <span>Positive enrichment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1 w-4 bg-down"></div>
          <span>Negative enrichment</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 border-t-2 border-dashed border-strong"></div>
          <span>Zero line</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-4 border-b-2 border-strong"></div>
          <span>Gene set hits ({geneSetSize})</span>
        </div>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-info-soft border border-info/30 rounded-control text-body-sm">
        <p className="font-semibold mb-2">How to interpret this plot:</p>
        <ul className="list-disc list-inside space-y-1 text-primary">
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
