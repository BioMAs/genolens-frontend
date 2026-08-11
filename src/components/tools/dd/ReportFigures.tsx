'use client';

/**
 * Figures en données du rapport Drug Discovery, dessinées côté interface.
 *
 * Le service (`genolens-dd`) verse les figures sous une union discriminée sur `kind` — il peut
 * en livrer une nature nouvelle avant que cette interface sache la dessiner. On distingue donc
 * trois cas, jamais un blanc silencieux :
 *   1. `kind` connu et au moins une barre  → le graphique.
 *   2. `kind` connu mais aucune barre      → rien du tout : un histogramme vide affirmerait
 *      « aucune cible » alors qu'il ne signifie que « rien à dessiner ».
 *   3. `kind` inconnu de cette version     → la légende de la figure, plus un avis explicite.
 *      Un client qui ne voit pas une figure doit savoir qu'il en manque une.
 *
 * Règles de marque (skill dataviz, validées par le script des six contrôles — non redérivées
 * ici) : série unique donc aucune légende ; une seule couleur par thème, choisie par étape (le
 * sombre n'est pas l'inverse automatique du clair) ; barres <= 24 px avec un écart de 2 px en
 * couleur de surface entre barres adjacentes ; extrémité arrondie côté donnée, carrée à la
 * ligne de base ; le texte reste toujours en encre de texte, jamais en couleur de donnée ;
 * valeur au bout de chaque barre ; une infobulle par barre avec sa cible de survol élargie ;
 * grille et axes discrets.
 *
 * La couleur de série (`--dd-bar-color`) est portée par CSS (voir globals.css, même mécanisme
 * que `--surface` / `--text-primary`) plutôt que par un hook de thème React : ce composant doit
 * pouvoir se rendre seul, sans `ThemeProvider` ambiant, notamment en test.
 */
import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

import type { DdFigure, DdTopTargetsBar, DdTopTargetsFigure } from '@/types/drugDiscovery';

/** Épaisseur de marque, jamais dépassée : l'air restant fait partie du dessin. */
const BAR_THICKNESS = 24;
/** Bande par barre = épaisseur + écart de 2 px (1 px de chaque côté une fois les barres centrées). */
const ROW_HEIGHT = 26;
const CHART_MARGIN = { top: 8, right: 46, bottom: 24, left: 4 };
const LABEL_COLUMN_WIDTH = 130;

interface ReportFiguresProps {
  figures: DdFigure[];
}

export function ReportFigures({ figures }: ReportFiguresProps) {
  const rendered = figures
    .map((figure, index) => renderFigure(figure, index))
    .filter((node): node is ReactElement => node !== null);

  if (rendered.length === 0) {
    return null;
  }

  return <div className="space-y-8">{rendered}</div>;
}

function renderFigure(figure: DdFigure, index: number) {
  if (figure.kind === 'top_targets') {
    // Une figure sans barre ne rend rien : cf. le commentaire d'en-tête.
    return figure.bars.length > 0 ? <TopTargetsFigure key={index} figure={figure} /> : null;
  }

  // `kind` inconnu de cette version de l'interface (le service en versionne chaque nature ;
  // une figure future arrivera sous un `kind` que ce composant ne reconnaît pas encore).
  return <UnknownFigureNotice key={index} caption={figure.caption} />;
}

function UnknownFigureNotice({ caption }: { caption: string }) {
  return (
    <figure className="rounded-md border border-dashed p-4 text-sm" style={{ borderColor: 'var(--border-strong)' }}>
      <figcaption className="mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
        {caption}
      </figcaption>
      <p style={{ color: 'var(--text-secondary)' }}>
        This figure is not rendered by this version of the interface.
      </p>
    </figure>
  );
}

interface ChartRow {
  gene_id: string;
  symbol: string;
  composite: number;
  evidence_ids: string[];
}

function TopTargetsFigure({ figure }: { figure: DdTopTargetsFigure }) {
  const rows: ChartRow[] = figure.bars.map((bar: DdTopTargetsBar) => ({
    gene_id: bar.gene_id,
    symbol: bar.symbol,
    composite: bar.composite,
    evidence_ids: bar.evidence_ids,
  }));

  const maxComposite = Math.max(0, ...rows.map((row) => row.composite));
  // Marge de tête pour que la valeur au bout de la barre la plus longue reste lisible.
  const domainMax = maxComposite > 0 ? maxComposite * 1.15 : 1;
  const chartHeight = rows.length * ROW_HEIGHT + CHART_MARGIN.top + CHART_MARGIN.bottom;

  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {figure.caption}
      </figcaption>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <BarChart
          width={640}
          height={chartHeight}
          data={rows}
          layout="vertical"
          margin={CHART_MARGIN}
          barCategoryGap={0}
          className="dd-figure-chart"
        >
          {/* Grille discrète : jamais au premier plan. */}
          <CartesianGrid
            horizontal={false}
            stroke="var(--border-subtle)"
            strokeDasharray="3 3"
          />
          <XAxis
            type="number"
            domain={[0, domainMax]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            tickFormatter={(value: number) => value.toFixed(2)}
          />
          <YAxis
            type="category"
            dataKey="symbol"
            width={LABEL_COLUMN_WIDTH}
            tickLine={false}
            axisLine={false}
            tick={<GeneLabelTick />}
          />
          {/* Une seule couleur de série, pas de légende : le titre nomme la mesure. */}
          <Bar
            dataKey="composite"
            fill="var(--dd-bar-color)"
            barSize={BAR_THICKNESS}
            // Arrondi côté donnée (droite ici), carré à la ligne de base.
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            {/* Valeur au bout de la barre — toujours en encre de texte, jamais dans la
                couleur de donnée (règle 4). Placée hors barre pour ne jamais dépendre d'une
                mesure de largeur de texte face à des barres parfois très courtes. */}
            <LabelList
              dataKey="composite"
              position="right"
              formatter={(value) => (typeof value === 'number' ? value.toFixed(2) : String(value ?? ''))}
              style={{ fill: 'var(--text-primary)', fontSize: 11 }}
            />
          </Bar>
          <Tooltip
            content={<BarTooltip />}
            cursor={{ fill: 'var(--hover-overlay)' }}
            isAnimationActive={false}
          />
        </BarChart>
      </div>
    </figure>
  );
}

interface GeneLabelTickProps {
  x?: number;
  y?: number;
  payload?: { value: string };
}

/** Libellé de gène : toujours en encre de texte, jamais en couleur de donnée (règle 4). */
function GeneLabelTick({ x, y, payload }: GeneLabelTickProps) {
  if (x === undefined || y === undefined || !payload) {
    return null;
  }
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={12}
      fill="var(--text-primary)"
      data-testid="dd-bar-label"
    >
      {payload.value}
    </text>
  );
}

function BarTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0].payload as ChartRow;
  return (
    <div
      className="rounded-md border p-2 text-xs shadow-sm"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      <div className="font-semibold">{row.symbol}</div>
      <div>Composite: {row.composite.toFixed(2)}</div>
      <div style={{ color: 'var(--text-secondary)' }}>Evidence: {row.evidence_ids.join(', ')}</div>
    </div>
  );
}
