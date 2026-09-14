'use client';

/**
 * Banc de verification des huit graphiques Plotly, en theme sombre.
 *
 * DEVELOPPEMENT UNIQUEMENT — la page repond 404 en production.
 *
 * Il existe parce que les huit graphiques Plotly du produit n'avaient JAMAIS
 * ete vus en theme sombre : ils demandent des donnees de projet que l'instance
 * locale n'a pas, et le seul harnais qui en dispose vise la production. C'est
 * ce trou qui a laisse passer un disque blanc de 200px au milieu du radar
 * d'enrichissement pendant toute la refonte.
 *
 * Ce que ce banc prouve : que `buildPlotlyLayout` produit des PIXELS corrects
 * une fois passe dans Plotly — fond transparent, encre et grille lisibles,
 * police du produit — avec les surcharges REELLES de chaque composant.
 *
 * Ce qu'il ne prouve pas : le comportement sur des donnees reelles (densite du
 * nuage de volcan, longueur des libelles de gene). Les traces sont synthetiques.
 */

import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Data, Layout } from 'plotly.js';
import { useChartTheme, useChartPalette, useChartScales } from '@/utils/chartTheme';
import { buildPlotlyLayout, mergePlotlyLayout } from '@/utils/plotlyLayout';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import ChartCard from '@/components/charts/ChartCard';
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

function Panel({
  title, data, layout, fixed,
}: { title: string; data: Data[]; layout: Partial<Layout>; fixed?: boolean }) {
  return (
    <figure className="gl-card p-4">
      <figcaption className="mb-4 text-title text-primary">{title}</figcaption>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, staticPlot: !fixed }}
        // Une scene 3D a besoin d'une taille mesurable a l'initialisation :
        // en largeur relative elle ne s'initialise pas du tout.
        style={fixed ? { width: 420, height: 300 } : { width: '100%' }}
        useResizeHandler={!fixed}
      />
    </figure>
  );
}

const GENES = ['TP53', 'BRCA1', 'EGFR', 'MYC', 'KRAS', 'PTEN'];

export default function PlotlyCheckPage() {
  // Fermee en production : c'est un outil de verification, pas une page du
  // produit. La laisser ouverte ferait d'un banc de debogage une route
  // accessible a tout utilisateur connecte.
  if (process.env.NODE_ENV === 'production') notFound();

  const t = useChartTheme();
  const palette = useChartPalette();
  const scales = useChartScales();

  return (
    <div className="page-container" data-measure="wide">
      <h1 className="text-display text-primary">Plotly — verification de theme</h1>
      <p className="mb-8 mt-2 text-body-sm text-secondary">
        Huit dispositions reelles, donnees synthetiques.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. DEGBarChart — barres horizontales, couleurs de direction */}
        <Panel
          title="1 · DEGBarChart"
          data={[{
            type: 'bar', orientation: 'h',
            x: [2.4, 1.8, 1.1, -1.3, -2.0, -2.7], y: GENES,
            marker: { color: [t.up, t.up, t.up, t.down, t.down, t.down] },
          } as Partial<Data> as Data]}
          layout={buildPlotlyLayout(t, {
            height: 260, margin: { l: 120, r: 60, t: 20, b: 50 },
            xaxis: { title: 'log2 Fold Change', zeroline: true },
            yaxis: { automargin: true, tickfont: { size: 11 } },
            shapes: [{ type: 'line', x0: 0, x1: 0, y0: -0.5, y1: 5.5,
              line: { color: t.axis, width: 1, dash: 'dot' } }],
          }) as Partial<Layout>}
        />

        {/* 2. GeneExpressionBoxplot */}
        <Panel
          title="2 · GeneExpressionBoxplot"
          data={[0, 1].map((i) => ({
            type: 'box', name: ['Control', 'Treated'][i],
            y: Array.from({ length: 24 }, (_, k) => 5 + i * 2 + Math.sin(k * 1.7) * 1.4),
            boxpoints: 'all', jitter: 0.4, marker: { color: palette.categorical[i] },
          } as Partial<Data> as Data))}
          layout={buildPlotlyLayout(t, {
            autosize: true, height: 260, margin: { l: 44, r: 8, t: 8, b: 28 },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: t.inkSubtle, size: 10 }, showlegend: false,
            xaxis: { gridcolor: t.grid, linecolor: t.grid },
            yaxis: { gridcolor: t.grid, linecolor: t.grid, zeroline: false },
          }) as Partial<Layout>}
        />

        {/* 3. VolcanoPanel — scattergl */}
        <Panel
          title="3 · VolcanoPanel (scattergl)"
          data={[{
            type: 'scattergl', mode: 'markers',
            x: Array.from({ length: 600 }, (_, i) => Math.sin(i) * 4),
            y: Array.from({ length: 600 }, (_, i) => Math.abs(Math.cos(i * 1.3)) * 8),
            marker: {
              size: 5,
              color: Array.from({ length: 600 }, (_, i) =>
                Math.sin(i) * 4 > 1 ? t.up : Math.sin(i) * 4 < -1 ? t.down : t.ns),
            },
          } as Partial<Data> as Data]}
          layout={buildPlotlyLayout(t, {
            autosize: true, height: 260, margin: { l: 60, r: 20, t: 10, b: 50 },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
            font: { color: t.inkSubtle, size: 11 },
            hovermode: 'closest', dragmode: 'pan', showlegend: false,
            xaxis: { title: { text: 'log2 fold change' } },
            yaxis: { title: { text: '−log10 adj. p' } },
          }) as Partial<Layout>}
        />

        {/* 4. EnrichmentAnalysis — radar */}
        <Panel
          title="4 · EnrichmentAnalysis (scatterpolar)"
          data={[0, 1].map((i) => ({
            type: 'scatterpolar', fill: 'toself',
            name: ['UP Regulated', 'DOWN Regulated'][i],
            r: [4, 3, 5, 2, 4.5, 4].map((v) => v - i),
            theta: ['Apoptosis', 'Cell cycle', 'Immune', 'Metabolism', 'Repair', 'Apoptosis'],
            line: { color: i === 0 ? scales.directionColors.up : scales.directionColors.down },
          } as Partial<Data> as Data))}
          layout={buildPlotlyLayout(t, {
            polar: { radialaxis: { visible: true, range: [0, 6] } },
            showlegend: true, title: { text: 'Top Enriched Pathways' },
            margin: { t: 50, b: 50, l: 50, r: 50 }, height: 300,
          }) as Partial<Layout>}
        />

        {/* 5. ClusteringAnalysis — carte de chaleur divergente */}
        <Panel
          title="5 · ClusteringAnalysis (heatmap)"
          data={[{
            type: 'heatmap',
            z: Array.from({ length: 8 }, (_, r) =>
              Array.from({ length: 10 }, (_, c) => Math.sin(r * 0.9 + c * 0.6) * 2)),
            colorscale: scales.diverging, reversescale: true, zmin: -2, zmax: 2,
            colorbar: { title: 'Z-Score' },
          } as Partial<Data> as Data]}
          layout={buildPlotlyLayout(t, {
            autosize: true, height: 280, margin: { t: 30, r: 50, b: 60, l: 80 },
            title: { text: 'Heatmap (8 genes x 10 samples)' },
            xaxis: { automargin: true, tickangle: -45 }, yaxis: { automargin: true },
          }) as Partial<Layout>}
        />

        {/* 6. DEGClusteringView — multi-axes : piste + barre laterale + carte */}
        <Panel
          title="6 · DEGClusteringView (multi-axes)"
          data={[
            { type: 'heatmap', z: [[0.1, 0.4, 0.7, 0.9]], x: ['S1', 'S2', 'S3', 'S4'],
              y: ['Condition'], colorscale: scales.diverging, showscale: false,
              xaxis: 'x', yaxis: 'y2' } as Partial<Data> as Data,
            { type: 'heatmap', z: [[1], [1], [-1], [-1], [-1], [1]], x: ['DEG'], y: GENES,
              colorscale: scales.direction, zmin: -1, zmax: 1, showscale: false,
              xaxis: 'x2', yaxis: 'y' } as Partial<Data> as Data,
            { type: 'heatmap',
              z: Array.from({ length: 6 }, (_, r) =>
                Array.from({ length: 4 }, (_, c) => Math.cos(r + c) * 2)),
              x: ['S1', 'S2', 'S3', 'S4'], y: GENES,
              colorscale: scales.sequential, zmin: -2, zmax: 2, showscale: true,
              colorbar: { title: { text: 'Scaled<br>expression', side: 'right' }, thickness: 15, len: 0.5, x: 1.02 },
              xaxis: 'x', yaxis: 'y' } as Partial<Data> as Data,
          ]}
          layout={buildPlotlyLayout(t, {
            autosize: true, height: 320,
            xaxis: { domain: [0.055, 1.0], tickangle: -45, showgrid: false, automargin: true },
            xaxis2: { domain: [0.0, 0.045], showticklabels: false, showgrid: false },
            yaxis: { autorange: 'reversed', showticklabels: false, showgrid: false, domain: [0.0, 0.93] },
            yaxis2: { domain: [0.95, 1.0], showticklabels: false, showgrid: false },
            title: { text: 'DEG heatmap', font: { size: 12, family: 'monospace' } },
            margin: { l: 55, r: 90, b: 60, t: 60 },
          }) as Partial<Layout>}
        />

        {/* 7. CustomVisualizationPanel — PCA, `colorway` passe explicitement */}
        <Panel
          title="7 · CustomVisualizationPanel (PCA)"
          data={['Control', 'Treated', 'Recovery'].map((g, i) => ({
            type: 'scatter', mode: 'markers', name: g,
            x: Array.from({ length: 8 }, (_, k) => Math.sin(k + i) * 3),
            y: Array.from({ length: 8 }, (_, k) => Math.cos(k * 1.4 + i) * 3),
            marker: { size: 10 },
          } as Partial<Data> as Data))}
          layout={buildPlotlyLayout(t, {
            colorway: palette.categorical,
            title: { text: 'PCA — 500 genes (72.4% variance explained)' },
            xaxis: { title: { text: 'PC1 (48.1%)' } },
            yaxis: { title: { text: 'PC2 (24.3%)' } },
            hovermode: 'closest', height: 300,
          }) as Partial<Layout>}
        />

        {/* 7bis. CustomVisualizationPanel — PCA 3D, sous-graphique `scene` */}
        <Panel
          fixed
          title="7bis · CustomVisualizationPanel (PCA 3D)"
          data={['Control', 'Treated'].map((g, i) => ({
            type: 'scatter3d', mode: 'markers', name: g,
            x: Array.from({ length: 10 }, (_, k) => Math.sin(k + i) * 3),
            y: Array.from({ length: 10 }, (_, k) => Math.cos(k * 1.2 + i) * 3),
            z: Array.from({ length: 10 }, (_, k) => Math.sin(k * 0.7 + i) * 3),
            marker: { size: 5, color: palette.categorical[i] },
          } as Partial<Data> as Data))}
          layout={buildPlotlyLayout(t, {
            title: { text: 'PCA 3D — 500 genes' },
            scene: {
              xaxis: { title: { text: 'PC1' } },
              yaxis: { title: { text: 'PC2' } },
              zaxis: { title: { text: 'PC3' } },
            },
            height: 300,
          }) as Partial<Layout>}
        />

        {/* 8. chat/PlotlyFigure — mise en page HOSTILE, via mergePlotlyLayout */}
        <Panel
          title="8 · chat/PlotlyFigure (mise en page de l’agent)"
          data={[{ type: 'bar', x: ['A', 'B', 'C'], y: [3, 5, 2] } as Partial<Data> as Data]}
          layout={mergePlotlyLayout(t, {
            // Ce que l'agent peut emettre, et que la chrome doit ecarter.
            height: 300,
            paper_bgcolor: 'white',
            plot_bgcolor: '#ffffff',
            font: { family: 'Comic Sans MS', color: '#000000' },
            title: { text: 'Counts per condition' },
          }) as Partial<Layout>}
        />
      </div>

      {/* Un graphique RECHARTS, pour verifier l'export SVG de bout en bout :
          c'est lui qui doit resoudre les jetons et embarquer la police. */}
      <div className="mt-6">
        <ChartCard
          title="9 · Recharts — verification de l’export"
          subtitle="Le bouton d’export produit un SVG autonome."
          minHeight={260}
          exportName="banc_export"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={GENES.map((g, i) => ({ gene: g, value: 12 - i * 1.7 }))}>
              <CartesianGrid {...CHART_GRID} />
              <XAxis dataKey="gene" {...CHART_AXIS} />
              <YAxis {...CHART_AXIS} />
              <Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR} />
              <Bar dataKey="value" fill={palette.categorical[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
