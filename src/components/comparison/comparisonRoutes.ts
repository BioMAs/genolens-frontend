/**
 * The comparison screen's view model and URL contract.
 *
 * The results page is being restructured from eleven mutually-exclusive `?tab=` values into
 * **three merged screens** plus a collapsed group for add-ons. This file holds the vocabulary
 * and the legacy-URL table; the module catalogue (`comparisonModules.ts`) assigns each module
 * to a view, and the nav renders the groups.
 *
 * Kept React-free, like the catalogue, so the whole mapping is unit-testable — a URL contract
 * is exactly the kind of logic that rots silently inside a component.
 *
 * **Why a query parameter and an anchor, not route segments.** `?view=` reuses the mechanics
 * already in place: `useSearchParams` plus `window.history.replaceState`, which switches panes
 * with no server round-trip. Real route segments would mean hoisting every fetch in
 * `ComparisonDetail` into a shared layout, or refetching per view — a much larger change with a
 * real regression surface. Worth revisiting once that component is decomposed.
 *
 * Position *within* a view is an anchor rather than a second parameter: anchors already are
 * scroll targets, the browser restores them on reload for free, and changing one does not
 * re-render through `useSearchParams` — so moving around a long screen costs nothing.
 */

/** The three merged screens, plus the collapsed group holding add-ons and niche tools. */
export type ComparisonView = 'explorer' | 'comprendre' | 'partager' | 'outils';

/** A named region inside a view — the anchor a link scrolls to. */
export type ComparisonPanel =
  | 'genes'
  | 'heatmap'
  | 'methods'
  | 'ai'
  | 'enrichment'
  | 'network'
  | 'signature'
  | 'report'
  | 'exports'
  | 'drug-discovery'
  | 'cosmetics'
  | 'custom-viz'
  | 'external-lookup';

/** The view a bare comparison URL opens. It carries no `?view=`, like the old `overview`. */
export const DEFAULT_VIEW: ComparisonView = 'explorer';

export const VIEW_PARAM = 'view';

/** Fixed order, so the nav and the module grid always agree on it. */
export const VIEW_ORDER: readonly ComparisonView[] = [
  'explorer',
  'comprendre',
  'partager',
  'outils',
];

/**
 * User-facing group names.
 *
 * English, to match every other string in the catalogue — module titles, descriptions and hints
 * are all English today, so French labels would read as a mix.
 */
export const VIEW_LABELS: Record<ComparisonView, string> = {
  explorer: 'Explore',
  comprendre: 'Understand',
  partager: 'Share',
  outils: 'Tools',
};

export const VIEW_DESCRIPTIONS: Record<ComparisonView, string> = {
  explorer: 'Which genes moved, and what each one does',
  comprendre: 'What those genes mean together',
  partager: 'Take the results out of the app',
  outils: 'Add-on modules and free-form tools',
};

export function isComparisonView(value: unknown): value is ComparisonView {
  return typeof value === 'string' && (VIEW_ORDER as readonly string[]).includes(value);
}

/** Where a legacy `?tab=` value lands. `panel` is null when the view has no obvious anchor. */
export interface LegacyTabTarget {
  view: ComparisonView;
  panel: ComparisonPanel | null;
}

/**
 * Every `?tab=` value the page ever accepted, and where it goes now.
 *
 * A bookmark must not break. `?tab=` is produced in exactly one place
 * (`ComparisonSidebarNav`) and consumed in one (`ComparisonDetail`), and no e2e spec references
 * it, so the blast radius is users' saved links — which is precisely what this table protects.
 * Keep it indefinitely; it is fifteen lines.
 *
 * Two entries deserve a note:
 *
 * - `overview` becomes Explorer. Its content is being split — the synthesis and stat strip move
 *   into the shared header, the AI reading to the top of Understand — so there is no overview
 *   view left to land on, and Explorer is the honest default.
 * - `integrations` becomes the network in Understand. That tab did three jobs — the PPI network,
 *   STRING enrichment and a GEO search — which now split across two views; the network was the
 *   headline, so it is where an old link should arrive.
 */
export const LEGACY_TAB_ROUTES: Record<string, LegacyTabTarget> = {
  overview: { view: 'explorer', panel: null },
  deg: { view: 'explorer', panel: 'genes' },
  clustering: { view: 'explorer', panel: 'heatmap' },
  metrics: { view: 'explorer', panel: 'methods' },
  enrichment: { view: 'comprendre', panel: 'enrichment' },
  signature: { view: 'comprendre', panel: 'signature' },
  integrations: { view: 'comprendre', panel: 'network' },
  report: { view: 'partager', panel: 'report' },
  cosmetics: { view: 'outils', panel: 'cosmetics' },
  'drug-discovery': { view: 'outils', panel: 'drug-discovery' },
  'custom-viz': { view: 'outils', panel: 'custom-viz' },
};

/**
 * Resolve a legacy `?tab=` value, or null when it names nothing.
 *
 * Returning null rather than a default keeps the intent of the old `isTabType` guard: a
 * hand-edited URL must not be able to select a pane that does not exist. The caller decides the
 * fallback, which is `DEFAULT_VIEW`.
 *
 * Note that a locked add-on needs no special case here. `?tab=cosmetics` resolves to `outils`,
 * which is exactly where the locked card and its "Request access" action live — strictly better
 * than the current behaviour, which bounces such a link to a blank overview.
 */
export function resolveLegacyTab(tab: string | null | undefined): LegacyTabTarget | null {
  if (!tab) return null;
  return LEGACY_TAB_ROUTES[tab] ?? null;
}

/**
 * The view a URL selects, preferring `?view=` and falling back to a legacy `?tab=`.
 *
 * Callers must **derive** the view with this rather than redirect in an effect: computing it
 * during render makes a cold `?tab=enrichment` link paint Understand on the first frame, where
 * an effect-based redirect would flash Explorer first.
 */
export function resolveView(params: URLSearchParams | null | undefined): ComparisonView {
  if (!params) return DEFAULT_VIEW;

  // `?view=` wins when both are present: it is the current contract, `tab` the legacy one.
  const view = params.get(VIEW_PARAM);
  if (isComparisonView(view)) return view;

  return resolveLegacyTab(params.get('tab'))?.view ?? DEFAULT_VIEW;
}

/**
 * Build the canonical link to a view, optionally anchored at a panel.
 *
 * `basePath` must carry no query string — it is the comparison's path, the same value
 * `ComparisonSidebarNav` already passes around. The default view is written bare, mirroring how
 * the existing tab switcher omits `tab` for its own default.
 */
export function buildViewHref(
  basePath: string,
  view: ComparisonView,
  panel?: ComparisonPanel | null
): string {
  const query = view === DEFAULT_VIEW ? '' : `?${VIEW_PARAM}=${view}`;
  const anchor = panel ? `#${panel}` : '';
  return `${basePath}${query}${anchor}`;
}

/**
 * Rewrite a legacy query string to the current contract, or null when nothing needs rewriting.
 *
 * Returned as a query string without its leading `?`. Callers use it for the cosmetic URL
 * cleanup after the first paint; null means "leave the URL alone", which keeps the tidy-up from
 * writing a history entry that changes nothing.
 */
export function upgradeLegacyQuery(params: URLSearchParams | null | undefined): string | null {
  if (!params) return null;

  const tab = params.get('tab');
  if (tab === null) return null;

  const next = new URLSearchParams(params);
  next.delete('tab');

  // An unknown tab is dropped rather than honoured, so a stale link cannot pin a dead pane.
  const target = resolveLegacyTab(tab);
  const view = target?.view ?? DEFAULT_VIEW;

  if (view === DEFAULT_VIEW) {
    next.delete(VIEW_PARAM);
  } else {
    next.set(VIEW_PARAM, view);
  }

  return next.toString();
}
