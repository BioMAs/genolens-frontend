/**
 * The comparison screen's view model and URL contract.
 *
 * The results page was restructured from eleven mutually-exclusive `?tab=` values into **four
 * screens that read as a sequence**: explore the genes, understand what they mean, apply the
 * comparison to a downstream question, share the result. This file holds the vocabulary and the
 * legacy-URL table; the module catalogue (`comparisonModules.ts`) assigns each module to a view,
 * and the nav renders the groups.
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

import { Compass, Lightbulb, Share2, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** The four screens of a comparison, in the order a user walks them. */
export type ComparisonView = 'explorer' | 'comprendre' | 'appliquer' | 'partager';

/** A named region inside a view — the anchor a link scrolls to. */
export type ComparisonPanel =
  | 'summary'
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

/**
 * Fixed order, so the nav, the hub and the module grid always agree on it.
 *
 * The order is the point: it is the sequence the hub numbers 1 → 4, and the only reason a
 * four-way split is easier to hold in mind than eleven tabs.
 */
export const VIEW_ORDER: readonly ComparisonView[] = [
  'explorer',
  'comprendre',
  'appliquer',
  'partager',
];

/**
 * User-facing screen names.
 *
 * English, to match every other string in the catalogue — module titles, descriptions and hints
 * are all English today, so French labels would read as a mix. The keys stay French, which is
 * what appears in `?view=`.
 */
export const VIEW_LABELS: Record<ComparisonView, string> = {
  explorer: 'Explore',
  comprendre: 'Understand',
  appliquer: 'Apply',
  partager: 'Share',
};

export const VIEW_DESCRIPTIONS: Record<ComparisonView, string> = {
  explorer: 'Which genes moved, and what each one does',
  comprendre: 'What those genes mean together',
  appliquer: 'Turn this comparison into targets, claims and scores',
  partager: 'Take the results out of the app',
};

/**
 * One icon per screen, kept beside the labels so the hub and the sidebar cannot drift apart.
 *
 * A lucide export is a component reference, not JSX or a hook, so this file stays as
 * unit-testable as it was — the catalogue already imports icons the same way.
 */
export const VIEW_ICONS: Record<ComparisonView, LucideIcon> = {
  explorer: Compass,
  comprendre: Lightbulb,
  appliquer: Target,
  partager: Share2,
};

export function isComparisonView(value: unknown): value is ComparisonView {
  return typeof value === 'string' && (VIEW_ORDER as readonly string[]).includes(value);
}

/**
 * `?view=` values that no longer name a screen, and where they now land.
 *
 * `outils` ("Tools") was defined by billing rather than intent: it held two plain exploration
 * modules — a database lookup and a free-form chart builder — next to the paid add-ons, so its
 * own description had to call itself "add-on modules and free-form tools". The add-ons became
 * `appliquer`, the two others moved to `explorer`. A saved link must still land somewhere true,
 * and `appliquer` is where the majority of that screen went.
 */
export const LEGACY_VIEW_ALIASES: Record<string, ComparisonView> = {
  outils: 'appliquer',
};

/** Resolve a retired `?view=` value, or null when it names nothing. */
export function resolveViewAlias(value: string | null | undefined): ComparisonView | null {
  if (!value) return null;
  return LEGACY_VIEW_ALIASES[value] ?? null;
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
 * - `overview` becomes the summary section at the top of Explorer. Most of that tab moved into
 *   the shared header and the AI reading to Understand, but the counts-and-pathways pair stayed
 *   together, so an old link still has an honest anchor.
 * - `integrations` becomes the network in Understand. That tab did three jobs — the PPI network,
 *   STRING enrichment and a GEO search — which now split across two views; the network was the
 *   headline, so it is where an old link should arrive.
 */
export const LEGACY_TAB_ROUTES: Record<string, LegacyTabTarget> = {
  overview: { view: 'explorer', panel: 'summary' },
  deg: { view: 'explorer', panel: 'genes' },
  clustering: { view: 'explorer', panel: 'heatmap' },
  metrics: { view: 'explorer', panel: 'methods' },
  'custom-viz': { view: 'explorer', panel: 'custom-viz' },
  enrichment: { view: 'comprendre', panel: 'enrichment' },
  integrations: { view: 'comprendre', panel: 'network' },
  signature: { view: 'appliquer', panel: 'signature' },
  cosmetics: { view: 'appliquer', panel: 'cosmetics' },
  'drug-discovery': { view: 'appliquer', panel: 'drug-discovery' },
  report: { view: 'partager', panel: 'report' },
};

/**
 * Resolve a legacy `?tab=` value, or null when it names nothing.
 *
 * Returning null rather than a default keeps the intent of the old `isTabType` guard: a
 * hand-edited URL must not be able to select a pane that does not exist. The caller decides the
 * fallback, which is `DEFAULT_VIEW`.
 *
 * Note that a locked add-on needs no special case here. `?tab=cosmetics` resolves to
 * `appliquer`, which is exactly where the locked card and its "Request access" action live —
 * strictly better than the old behaviour, which bounced such a link to a blank overview.
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

  const aliased = resolveViewAlias(view);
  if (aliased) return aliased;

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
 *
 * Two kinds of legacy input reach here: a `?tab=` from before the restructure, and a
 * `?view=outils` from before Tools became Apply.
 */
export function upgradeLegacyQuery(params: URLSearchParams | null | undefined): string | null {
  if (!params) return null;

  const rawView = params.get(VIEW_PARAM);
  const tab = params.get('tab');
  const aliasedView = resolveViewAlias(rawView);

  // Nothing legacy in play. An unrecognised `?view=` is left alone rather than normalised: it
  // already resolves to the default, and rewriting it would spend a history entry on a typo.
  if (tab === null && aliasedView === null) return null;

  const next = new URLSearchParams(params);
  next.delete('tab');

  // A current `?view=` wins over `?tab=`, exactly as `resolveView` reads them — so the rewrite
  // can never change which screen the URL selects. An unknown tab is dropped rather than
  // honoured, so a stale link cannot pin a dead pane.
  const view = isComparisonView(rawView)
    ? rawView
    : (aliasedView ?? resolveLegacyTab(tab)?.view ?? DEFAULT_VIEW);

  if (view === DEFAULT_VIEW) {
    next.delete(VIEW_PARAM);
  } else {
    next.set(VIEW_PARAM, view);
  }

  return next.toString();
}
