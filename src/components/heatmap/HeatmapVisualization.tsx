'use client';

import dynamic from 'next/dynamic';
import { HeatmapData, HeatmapConfig } from './types';
import { useRef, useEffect } from 'react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface HeatmapVisualizationProps {
  plotData: HeatmapData;
  config: HeatmapConfig;
  geneMetadata: Map<string, { logFC: number; padj: number }>;
  title?: string;
  showSidebar?: boolean;
  onPlotReady?: (plotDiv: HTMLDivElement) => void;
}

export default function HeatmapVisualization({
  plotData,
  config,
  geneMetadata,
  title,
  showSidebar = true,
  onPlotReady,
}: HeatmapVisualizationProps) {
  const mainPlotRef = useRef<HTMLDivElement>(null);
  const sidebarPlotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mainPlotRef.current && onPlotReady) {
      onPlotReady(mainPlotRef.current);
    }
  }, [plotData, onPlotReady]);

  // Build custom hover template with gene metadata
  const buildHoverTemplate = (geneId: string, sample: string, z: number): string => {
    const metadata = geneMetadata.get(geneId);
    let template = `<b>${geneId}</b><br>`;
    template += `Échantillon: ${sample}<br>`;
    template += `Expression: ${z.toFixed(2)}<br>`;
    if (metadata) {
      template += `LogFC: ${metadata.logFC.toFixed(2)}<br>`;
      template += `padj: ${metadata.padj.toExponential(2)}`;
    }
    template += '<extra></extra>';
    return template;
  };

  // Create hover text matrix for main heatmap
  const hoverText = plotData.z.map((row, rowIdx) =>
    row.map((value, colIdx) => {
      const geneId = plotData.y[rowIdx];
      const sample = plotData.x[colIdx];
      return buildHoverTemplate(geneId, sample, value);
    })
  );

  // Find separator line between UP and DOWN genes
  // UP genes have positive LogFC, DOWN have negative
  let separatorIndex = -1;
  for (let i = 0; i < plotData.logFCs.length - 1; i++) {
    if (plotData.logFCs[i] > 0 && plotData.logFCs[i + 1] < 0) {
      separatorIndex = i + 0.5;
      break;
    }
  }

  const defaultTitle = title || `Clustered Heatmap (${plotData.y.length} DEGs)`;

  return (
    <div className="w-full h-full flex overflow-hidden">
      {/* Main Heatmap */}
      <div ref={mainPlotRef} className="flex-1 min-w-0">
        <Plot
          data={[
            {
              z: plotData.z,
              x: plotData.x,
              y: plotData.y,
              type: 'heatmap',
              colorscale: config.colorscale,
              reversescale: true,
              zmin: config.zmin,
              zmax: config.zmax,
              showscale: true,
              hovertext: hoverText,
              hoverinfo: 'text',
              colorbar: {
                title: { text: 'Rel. Expr', side: 'right' },
                thickness: 15,
                len: 0.5,
                x: 1.02,
              },
            } as any,
          ]}
          layout={{
            autosize: true,
            height: config.height,
            margin: config.mainMargin,
            xaxis: {
              tickangle: -45,
              side: 'bottom',
              tickfont: { size: 10 },
              showgrid: false,
            },
            yaxis: {
              autorange: 'reversed',
              showticklabels: false,
              ticks: '',
              showgrid: false,
            },
            title: {
              text: defaultTitle,
              font: { size: 14 },
            },
            paper_bgcolor: 'white',
            plot_bgcolor: 'white',
            shapes:
              separatorIndex >= 0
                ? [
                    {
                      type: 'line',
                      x0: -0.5,
                      x1: plotData.x.length - 0.5,
                      y0: separatorIndex,
                      y1: separatorIndex,
                      line: {
                        color: 'rgba(0, 0, 0, 0.3)',
                        width: 2,
                        dash: 'dash',
                      },
                    },
                  ]
                : [],
            annotations:
              separatorIndex >= 0
                ? [
                    {
                      x: -0.8,
                      y: separatorIndex / 2,
                      text: 'UP',
                      showarrow: false,
                      font: { size: 10, color: 'darkred' },
                      textangle: '-90',
                      xanchor: 'center',
                      yanchor: 'middle',
                    },
                    {
                      x: -0.8,
                      y: separatorIndex + (plotData.y.length - separatorIndex) / 2,
                      text: 'DOWN',
                      showarrow: false,
                      font: { size: 10, color: 'darkblue' },
                      textangle: '-90',
                      xanchor: 'center',
                      yanchor: 'middle',
                    },
                  ]
                : [],
          }}
          useResizeHandler={true}
          className="w-full h-full"
          config={{
            displayModeBar: true,
            modeBarButtonsToRemove: ['lasso2d', 'select2d'],
            displaylogo: false,
            toImageButtonOptions: {
              format: 'png',
              filename: 'heatmap',
              height: config.height,
              width: 1200,
              scale: 2,
            },
          }}
        />
      </div>

      {/* LogFC Sidebar */}
      {showSidebar && (
        <div ref={sidebarPlotRef} className="w-20 ml-1 shrink-0">
          <Plot
            data={[
              {
                z: plotData.logFCs.map((v: number) => [v]),
                x: ['LogFC'],
                y: plotData.y,
                type: 'heatmap',
                colorscale: config.logFCColorscale,
                showscale: false,
                zmin: config.logFCmin,
                zmax: config.logFCmax,
                hovertemplate:
                  '<b>%{y}</b><br>LogFC: %{z:.2f}<extra></extra>',
              } as any,
            ]}
            layout={{
              autosize: true,
              height: config.height,
              margin: config.sidebarMargin,
              xaxis: {
                side: 'top',
                tickangle: -90,
                tickfont: { size: 9 },
                showgrid: false,
              },
              yaxis: {
                autorange: 'reversed',
                showticklabels: false,
                ticks: '',
                showgrid: false,
              },
              title: {
                text: '',
              },
              paper_bgcolor: 'white',
              plot_bgcolor: 'white',
            }}
            useResizeHandler={true}
            className="w-full h-full"
            config={{
              displayModeBar: false,
              staticPlot: true,
            }}
          />
        </div>
      )}
    </div>
  );
}
