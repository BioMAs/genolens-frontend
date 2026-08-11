'use client';

/**
 * Figures en données du rapport Drug Discovery, dessinées côté interface.
 *
 * Le service (`genolens-dd`) verse les figures sous une union discriminée sur `kind` — il peut
 * en livrer une nature nouvelle avant que cette interface sache la dessiner. `DdFigure` (voir
 * `types/drugDiscovery.ts`) est donc la forme du **fil** : `kind: string`, pas le littéral
 * d'une figure connue. `DdKnownFigure` est l'union fermée que cette version sait dessiner ;
 * `toKnownFigure` est l'unique frontière entre les deux, et le seul endroit du module qui fait
 * confiance à ce que le service a versé sous un `kind`. On distingue trois cas, jamais un blanc
 * silencieux :
 *   1. `kind` connu, majeure supportée, et au moins une barre → le graphique.
 *   2. `kind` connu mais aucune barre      → rien du tout : un histogramme vide affirmerait
 *      « aucune cible » alors qu'il ne signifie que « rien à dessiner ».
 *   3. `kind` inconnu, ou majeure non supportée → la légende de la figure, plus un avis
 *      explicite. Un `top_targets` v2 remis à un renderer v1 serait rendu faux plutôt que
 *      absent ; c'est pourquoi la majeure est gatée exactement comme le `kind`, par le même
 *      chemin. Un client qui ne voit pas une figure doit savoir qu'il en manque une.
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
 *
 * La largeur seule est fluide (`ResponsiveContainer width="100%"`), la hauteur reste dérivée du
 * nombre de barres (`ROW_HEIGHT * n`). Ne PAS revenir à une largeur *et* hauteur fixes mises à
 * l'échelle par CSS (`width:100%; height:auto` sur le `<svg>`) : le `viewBox` grandirait/
 * rétrécirait alors uniformément, texte compris — sur un conteneur mobile (~360-414 px) les
 * libellés de gènes tomberaient à ~6-7px effectifs. `ResponsiveContainer` fait mesurer la vraie
 * largeur du conteneur par recharts et recalcule la mise en page (remise en page), alors que les
 * `fontSize` restent des px SVG réels puisque le `viewBox` correspond toujours à la taille
 * mesurée — le texte ne rétrécit jamais, la figure se réorganise.
 */
import type { ReactElement } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';

import type {
  DdFigure,
  DdKnownFigure,
  DdTopTargetsBar,
  DdTopTargetsFigure,
} from '@/types/drugDiscovery';

/** Épaisseur de marque, jamais dépassée : l'air restant fait partie du dessin. */
const BAR_THICKNESS = 24;
/** Bande par barre = épaisseur + écart de 2 px (1 px de chaque côté une fois les barres centrées). */
const ROW_HEIGHT = 26;
const CHART_MARGIN = { top: 6, right: 46, bottom: 4, left: 4 };
/**
 * Hauteur explicitement réservée à l'axe X (ticks + libellés), passée telle quelle à `<XAxis
 * height=…>`. Sans elle, recharts ajoute son propre défaut interne (~30 px) EN PLUS de
 * `CHART_MARGIN.bottom`, et la zone de tracé réelle devient plus petite que `rows.length *
 * ROW_HEIGHT` — les barres se retrouvent alors plus fines que `BAR_THICKNESS` avec un écart
 * différent de 2 px. En la fixant ici et en l'incluant dans `chartHeight`, la zone de tracé
 * vaut exactement `rows.length * ROW_HEIGHT`, quelle que soit la largeur mesurée.
 */
const X_AXIS_HEIGHT = 20;
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

/**
 * Majeure supportée par cette version de l'interface, par `kind` connu. Un service qui
 * bumperait la majeure d'une figure sans coordination doit tomber sur l'avis explicite,
 * jamais sur un renderer qui dessinerait une forme qu'il ne connaît pas vraiment.
 */
const SUPPORTED_MAJOR_VERSION: Record<DdKnownFigure['kind'], number> = {
  top_targets: 1,
};

function majorVersion(version: string): number {
  return Number(version.split('.')[0]);
}

/**
 * Frontière entre la forme du fil et l'union connue. Le seul cast du module : au-delà de ce
 * point, `renderKnownFigure` est exhaustif et vérifié par `tsc` (voir son docstring) ; en
 * amont, on ne peut que faire confiance à ce que le service a versé sous ce `kind`.
 *
 * Rend `null` aussi bien pour un `kind` inconnu que pour une majeure non supportée d'un
 * `kind` connu — un `top_targets` v2 doit tomber sur le même avis qu'une figure future,
 * jamais être remis tel quel à un renderer v1 qui le dessinerait faux plutôt qu'absent.
 */
function toKnownFigure(figure: DdFigure): DdKnownFigure | null {
  if (
    figure.kind === 'top_targets' &&
    majorVersion(figure.version) === SUPPORTED_MAJOR_VERSION.top_targets
  ) {
    return figure as unknown as DdTopTargetsFigure;
  }
  return null;
}

function renderFigure(figure: DdFigure, index: number) {
  const known = toKnownFigure(figure);
  if (known === null) {
    // `kind` inconnu de cette version de l'interface, ou majeure non supportée d'un `kind`
    // connu (le service en versionne chaque nature ; une figure future ou une majeure
    // future peut arriver avant que ce composant sache la dessiner).
    return <UnknownFigureNotice key={index} caption={figure.caption} />;
  }
  return renderKnownFigure(known, index);
}

/**
 * Rendu d'une nature de figure connue, indexé par `kind`. Exhaustif **par le type du
 * `Record`**, pas par un contrôle de flux : TypeScript ne réduit pas une variable à
 * `never` après un test d'égalité sur la propriété d'un type qui n'a qu'un seul membre
 * (essayé — `if (figure.kind === 'top_targets') {…} else return assertNever(figure)` ne
 * compile pas tant que `DdKnownFigure` n'a qu'une seule nature), contrairement à mypy sur
 * un `isinstance` unique côté service (`report/latex.py`). Le `Record` mappé sur
 * `DdKnownFigure['kind']` n'a pas ce trou : il exige une entrée par nature dès aujourd'hui,
 * à un membre comme à dix, et son absence fait échouer `tsc` immédiatement — c'est
 * l'équivalent fonctionnel d'`assertNever`, robuste au cas à un seul membre que ce lot vit.
 */
type KnownFigureRenderer<K extends DdKnownFigure['kind']> = (
  figure: Extract<DdKnownFigure, { kind: K }>,
  index: number
) => ReactElement | null;

const RENDER_KNOWN_FIGURE: { [K in DdKnownFigure['kind']]: KnownFigureRenderer<K> } = {
  top_targets: (figure, index) =>
    // Une figure sans barre ne rend rien : cf. le commentaire d'en-tête.
    figure.bars.length > 0 ? <TopTargetsFigure key={index} figure={figure} /> : null,
};

function renderKnownFigure(figure: DdKnownFigure, index: number) {
  return RENDER_KNOWN_FIGURE[figure.kind](figure, index);
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
  const chartHeight =
    rows.length * ROW_HEIGHT + CHART_MARGIN.top + CHART_MARGIN.bottom + X_AXIS_HEIGHT;

  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {figure.caption}
      </figcaption>
      <div style={{ width: '100%', maxWidth: 640 }}>
        {/* Largeur fluide, hauteur figée par le nombre de barres : cf. le commentaire d'en-tête
            sur pourquoi ce doit être `ResponsiveContainer`, pas une mise à l'échelle CSS. */}
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={rows} layout="vertical" margin={CHART_MARGIN} barCategoryGap={0}>
            {/* Grille discrète : jamais au premier plan. */}
            <CartesianGrid
              horizontal={false}
              stroke="var(--border-subtle)"
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              height={X_AXIS_HEIGHT}
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
        </ResponsiveContainer>
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

export function BarTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
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
