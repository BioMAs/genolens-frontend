import type { Config } from 'plotly.js';
import type { ChartTheme } from '@/utils/chartTheme';
import { getPalette } from '@/utils/chartPalettes';

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

  return applySubplotChrome(mergeOneLevel(base, overrides), theme);
}

/**
 * Les fonds des SOUS-GRAPHIQUES, que `paper_bgcolor` ne couvre pas.
 *
 * Plotly dessine le polaire, la scene 3D, le ternaire et la carte dans leur
 * propre conteneur, avec leur propre fond — blanc par defaut. Un radar rendait
 * donc un DISQUE BLANC de 200px au milieu d'un panneau sombre, et rien ne le
 * signalait : les tests n'assertent que `paper_bgcolor` et `plot_bgcolor`, et
 * la garde statique ne cherche qu'un `'white'` ECRIT — or personne ne l'ecrit,
 * c'est le defaut de la bibliotheque.
 *
 * La chrome est reappliquee APRES la fusion, et en profondeur : un appelant qui
 * passe `polar: { radialaxis: { range } }` remplace tout l'objet `polar` en
 * fusion d'un niveau, donc il emporterait le fond avec lui. C'est exactement ce
 * que fait le radar d'enrichissement.
 */
function applySubplotChrome(layout: PlotlyLayout, theme: ChartTheme): PlotlyLayout {
  const out = { ...layout };
  const transparent = 'rgba(0,0,0,0)';
  const axis = {
    gridcolor: theme.grid,
    linecolor: theme.axis,
    tickfont: { color: theme.inkMuted, size: 11 },
  };

  if (isPlainObject(out.polar)) {
    const polar = out.polar as PlotlyLayout;
    out.polar = {
      ...polar,
      bgcolor: transparent,
      radialaxis: { ...axis, ...(isPlainObject(polar.radialaxis) ? polar.radialaxis : {}) },
      angularaxis: { ...axis, ...(isPlainObject(polar.angularaxis) ? polar.angularaxis : {}) },
    };
  }

  if (isPlainObject(out.scene)) {
    const scene = out.scene as PlotlyLayout;
    // En 3D le fond est porte par CHAQUE axe, pas par la scene.
    const sceneAxis = {
      backgroundcolor: transparent,
      showbackground: false,
      gridcolor: theme.grid,
      zerolinecolor: theme.axis,
      color: theme.inkMuted,
    };
    out.scene = {
      ...scene,
      xaxis: { ...sceneAxis, ...(isPlainObject(scene.xaxis) ? scene.xaxis : {}) },
      yaxis: { ...sceneAxis, ...(isPlainObject(scene.yaxis) ? scene.yaxis : {}) },
      zaxis: { ...sceneAxis, ...(isPlainObject(scene.zaxis) ? scene.zaxis : {}) },
    };
  }

  if (isPlainObject(out.ternary)) {
    out.ternary = { ...(out.ternary as PlotlyLayout), bgcolor: transparent };
  }
  if (isPlainObject(out.geo)) {
    out.geo = { ...(out.geo as PlotlyLayout), bgcolor: transparent };
  }

  return out;
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
 * Palette categorielle de repli, tiree de la source unique plutot que recopiee
 * a la main — c'est une recopie qui avait laisse ici une liste perimee.
 *
 * Elle ne s'applique qu'aux traces qui ne fixent PAS leur propre couleur. Un
 * appelant qui affiche plusieurs series passe `colorway: palette.categorical`
 * (via `useChartPalette`, qui suit le theme et la preference de daltonisme) :
 * la fabrique ne recoit que le theme CSS, elle ne peut pas connaitre la
 * preference de l'utilisateur.
 */
const CATEGORICAL = getPalette('standard', 'light').categorical;

export function buildPlotlyConfig(opts: {
  filename: string;
  interactive?: boolean;
}): Partial<Config> {
  return {
    displayModeBar: true,
    displaylogo: false,
    responsive: true,
    // `select2d` et `lasso2d` ne servent qu'aux traces ou une selection a un
    // sens — le nuage de volcan. Ailleurs ils encombrent la barre d'outils.
    modeBarButtonsToRemove: opts.interactive ? [] : ['select2d', 'lasso2d'],
    toImageButtonOptions: {
      format: 'png',
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
  // Les SOUS-GRAPHIQUES definissent la forme du graphique — l'etendue d'un axe
  // radial, les titres d'une scene 3D — donc ils appartiennent a l'appelant.
  // Les jeter rendait un radar produit par l'agent avec des axes par defaut.
  // Leur CHROME est reimposee ensuite par `applySubplotChrome`, qui tourne
  // dans `buildPlotlyLayout` : structure de l'appelant, couleurs du theme.
  'polar', 'scene', 'ternary', 'geo',
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
