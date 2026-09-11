import type { ChartTheme } from '@/utils/chartTheme';

/**
 * Fabrique de mise en page Plotly.
 *
 * Chacun des huit composants Plotly declarait sa mise en page en ligne, et
 * `PLOT_THEME` etait defini TROIS fois independamment, avec les memes valeurs.
 * Trois defauts partages par tous :
 *
 *   - AUCUN ne fixait `font.family`. Plotly dessine donc en Open Sans, une
 *     police que l'application n'utilise nulle part ailleurs : chaque graphique
 *     etait typographie comme un corps etranger.
 *   - AUCUN ne fixait `colorway`, donc les series categorielles tombaient sur
 *     la palette D3 par defaut, sans rapport avec celle du reste du produit.
 *   - AUCUN ne stylait `hoverlabel`, donc tous les survols rendaient la boite
 *     par defaut de Plotly.
 *
 * Et cinq des huit ne repondaient pas au theme sombre — `DEGClusteringView`
 * posant litteralement `paper_bgcolor: 'white'`.
 */

/** Sous-ensemble de la mise en page Plotly que cette fabrique manipule. */
export type PlotlyLayout = Record<string, unknown>;

/** Cles fusionnees en profondeur d'un niveau. */
const NESTED = ['xaxis', 'yaxis', 'xaxis2', 'yaxis2', 'legend', 'hoverlabel', 'margin', 'font'];

export function buildPlotlyLayout(theme: ChartTheme, overrides: PlotlyLayout = {}): PlotlyLayout {
  const axis = {
    gridcolor: theme.grid,
    zerolinecolor: theme.axis,
    linecolor: theme.axis,
    tickcolor: theme.axis,
    tickfont: { color: theme.inkMuted, size: 11 },
    titlefont: { color: theme.inkSubtle, size: 12 },
    automargin: true,
  };

  const base: PlotlyLayout = {
    autosize: true,
    // Transparent plutot que la surface : le graphique herite du fond de sa
    // carte, donc il reste juste meme si la carte change de niveau.
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: theme.fontFamily, size: 12, color: theme.inkSubtle },
    colorway: CATEGORICAL,
    xaxis: axis,
    yaxis: axis,
    hoverlabel: {
      bgcolor: theme.surfaceRaised,
      bordercolor: theme.axis,
      font: { family: theme.fontFamily, size: 12, color: theme.ink },
    },
    legend: { font: { color: theme.inkSubtle, size: 11 } },
    margin: { l: 48, r: 16, t: 16, b: 40 },
  };

  return mergeOneLevel(base, overrides);
}

/**
 * Fusion en profondeur d'UN niveau.
 *
 * Un simple etalement perdrait silencieusement le theme : `{...base, ...over}`
 * avec `over.xaxis = { title: 'x' }` remplace tout l'objet `xaxis`, donc
 * `gridcolor`, `tickfont` et le reste disparaissent. C'est exactement la classe
 * de defaut que cette fabrique remplace.
 */
function mergeOneLevel(base: PlotlyLayout, over: PlotlyLayout): PlotlyLayout {
  const out: PlotlyLayout = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (NESTED.includes(key) && isPlainObject(base[key]) && isPlainObject(value)) {
      out[key] = { ...(base[key] as object), ...(value as object) };
      continue;
    }
    out[key] = value;
  }
  return out;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Palette categorielle, en attendant la refonte complete (vague C0 du plan).
 *
 * L'ancienne etait trois couleurs de marque suivies des SEPT couleurs de demo
 * de Recharts. Celles-ci sont au moins tirees des tokens de donnees existants.
 */
const CATEGORICAL = [
  '#4f46e5', '#0f9d6b', '#d97706', '#db2777',
  '#0284c7', '#7c3aed', '#65a30d', '#c2410c',
];

export function buildPlotlyConfig(opts: { filename: string; interactive?: boolean }) {
  return {
    displaylogo: false,
    responsive: true,
    // `select2d` et `lasso2d` ne servent qu'aux traces ou une selection a un
    // sens — le nuage de volcan. Ailleurs ils encombrent la barre d'outils.
    modeBarButtonsToRemove: opts.interactive ? [] : ['select2d', 'lasso2d'],
    toImageButtonOptions: {
      format: 'png' as const,
      filename: opts.filename,
      height: 600,
      width: 900,
      scale: 2,
    },
  };
}

/**
 * Cles dont la SEMANTIQUE appartient a l'appelant : ce que le graphique dit.
 * Une mise en page fournie par un agent doit pouvoir les imposer.
 */
const SEMANTIC_KEYS = [
  'barmode', 'boxmode', 'violinmode', 'annotations', 'shapes', 'showlegend',
  'title', 'images', 'updatemenus', 'sliders',
];

/** Cles de PRESENTATION : l'appelant peut les proposer, sans enjeu de lisibilite. */
const PRESENTATION_KEYS = ['height', 'width', 'margin', 'legend', 'dragmode', 'hovermode'];

/**
 * Cles de CHROME : le theme les impose toujours, l'entrant est ecarte.
 *
 * Un agent ne doit pas pouvoir emettre un fond blanc dans une application en
 * theme sombre, ni une police qui n'est pas celle du produit.
 */
const CHROME_KEYS = ['paper_bgcolor', 'plot_bgcolor', 'font', 'hoverlabel', 'colorway'];

/**
 * Fusionne une mise en page ARBITRAIRE — typiquement produite par l'assistant —
 * avec le theme.
 *
 * L'implementation actuelle de `chat/PlotlyFigure` fait `{...defauts, ...layout}`,
 * donc la spec entrante ecrase TOUT. C'est sans consequence aujourd'hui, faute
 * de defauts de theme ; ce sera fatal des que cette fabrique sera branchee.
 *
 * L'ordre est porteur : la chrome est reappliquee EN DERNIER, de facon
 * inconditionnelle. Une cle nouvelle, emise par une version future de l'agent,
 * ne pourra donc jamais casser le theme en silence.
 */
export function mergePlotlyLayout(theme: ChartTheme, incoming: PlotlyLayout = {}): PlotlyLayout {
  const allowed: PlotlyLayout = {};
  for (const key of [...SEMANTIC_KEYS, ...PRESENTATION_KEYS]) {
    if (key in incoming) allowed[key] = incoming[key];
  }

  // Les axes sont un cas mixte : leur titre et leur echelle appartiennent a
  // l'appelant, leurs couleurs au theme. On ne retient que le premier groupe.
  for (const axisKey of ['xaxis', 'yaxis', 'xaxis2', 'yaxis2']) {
    const axis = incoming[axisKey];
    if (!isPlainObject(axis)) continue;
    const kept: Record<string, unknown> = {};
    for (const k of ['title', 'type', 'range', 'autorange', 'tickformat', 'tickvals',
                     'ticktext', 'showgrid', 'zeroline', 'categoryorder', 'categoryarray']) {
      if (k in axis) kept[k] = axis[k];
    }
    if (Object.keys(kept).length) allowed[axisKey] = kept;
  }

  const merged = buildPlotlyLayout(theme, allowed);

  // La chrome reprend la main, quoi qu'ait envoye l'appelant.
  const chrome = buildPlotlyLayout(theme);
  for (const key of CHROME_KEYS) merged[key] = chrome[key];
  for (const axisKey of ['xaxis', 'yaxis', 'xaxis2', 'yaxis2']) {
    if (!isPlainObject(merged[axisKey])) continue;
    merged[axisKey] = {
      ...(merged[axisKey] as object),
      gridcolor: theme.grid,
      zerolinecolor: theme.axis,
      linecolor: theme.axis,
      tickfont: { color: theme.inkMuted, size: 11 },
    };
  }

  return merged;
}
