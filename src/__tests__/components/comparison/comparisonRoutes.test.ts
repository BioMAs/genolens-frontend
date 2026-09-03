/**
 * The migration contract of the comparison screen's URL.
 *
 * Eleven `?tab=` values become four views. Users have saved links to those tabs, so the table is
 * asserted exhaustively and **driven by the tab list itself** — adding a tab value without a
 * mapping fails here rather than in production.
 */
import {
  buildViewHref,
  DEFAULT_VIEW,
  isComparisonView,
  LEGACY_TAB_ROUTES,
  resolveLegacyTab,
  resolveView,
  upgradeLegacyQuery,
  VIEW_LABELS,
  VIEW_ORDER,
  type ComparisonView,
} from '@/components/comparison/comparisonRoutes';

/** Every `?tab=` value ComparisonDetail ever accepted, from its own TabType union. */
const EVERY_LEGACY_TAB = [
  'overview',
  'deg',
  'metrics',
  'enrichment',
  'cosmetics',
  'report',
  'clustering',
  'integrations',
  'custom-viz',
  'signature',
  'drug-discovery',
] as const;

const params = (query: string) => new URLSearchParams(query);

describe('the view vocabulary', () => {
  it('has exactly four views, in a fixed order the nav and the grid can both rely on', () => {
    expect(VIEW_ORDER).toEqual(['explorer', 'comprendre', 'partager', 'outils']);
  });

  it('opens on Explorer by default', () => {
    expect(DEFAULT_VIEW).toBe('explorer');
    expect(VIEW_ORDER[0]).toBe(DEFAULT_VIEW);
  });

  it('labels every view', () => {
    for (const view of VIEW_ORDER) {
      expect(VIEW_LABELS[view]).toBeTruthy();
    }
  });

  it('recognises a view and rejects anything else', () => {
    expect(isComparisonView('comprendre')).toBe(true);
    expect(isComparisonView('overview')).toBe(false); // the old default is not a view
    expect(isComparisonView('')).toBe(false);
    expect(isComparisonView(null)).toBe(false);
    expect(isComparisonView(42)).toBe(false);
  });
});

describe('resolveLegacyTab', () => {
  // Table-driven on purpose: a new tab value with no mapping fails the build here.
  it.each(EVERY_LEGACY_TAB)('maps %s to a real view', (tab) => {
    const target = resolveLegacyTab(tab);
    expect(target).not.toBeNull();
    expect(VIEW_ORDER).toContain(target!.view as ComparisonView);
  });

  it('covers every legacy tab and nothing more', () => {
    expect(Object.keys(LEGACY_TAB_ROUTES).sort()).toEqual([...EVERY_LEGACY_TAB].sort());
  });

  it('lands overview on Explorer with no anchor, its content having been split', () => {
    expect(resolveLegacyTab('overview')).toEqual({ view: 'explorer', panel: null });
  });

  it('keeps the three analysis tabs together in Explorer', () => {
    expect(resolveLegacyTab('deg')).toEqual({ view: 'explorer', panel: 'genes' });
    expect(resolveLegacyTab('clustering')).toEqual({ view: 'explorer', panel: 'heatmap' });
    expect(resolveLegacyTab('metrics')).toEqual({ view: 'explorer', panel: 'methods' });
  });

  it('sends the interpretation tabs to Understand', () => {
    expect(resolveLegacyTab('enrichment')).toEqual({ view: 'comprendre', panel: 'enrichment' });
    expect(resolveLegacyTab('signature')).toEqual({ view: 'comprendre', panel: 'signature' });
  });

  // That tab did three jobs, now split across two views; the network was the headline.
  it('lands integrations on the network in Understand', () => {
    expect(resolveLegacyTab('integrations')).toEqual({ view: 'comprendre', panel: 'network' });
  });

  // Strictly better than today, which bounces a locked add-on link to a blank overview:
  // Tools is where the locked card and its Request access action actually live.
  it('retargets a locked add-on to Tools rather than nowhere', () => {
    expect(resolveLegacyTab('cosmetics')).toEqual({ view: 'outils', panel: 'cosmetics' });
    expect(resolveLegacyTab('drug-discovery')).toEqual({
      view: 'outils',
      panel: 'drug-discovery',
    });
  });

  // custom-viz was a valid tab value no card and no sidebar entry pointed at — reachable only
  // by hand-typing a URL. The restructure finally gives it a home.
  it('gives custom-viz a home in Tools', () => {
    expect(resolveLegacyTab('custom-viz')).toEqual({ view: 'outils', panel: 'custom-viz' });
  });

  // Returning null, not a default, preserves the intent of the old isTabType guard: a
  // hand-edited URL must not be able to select a pane that does not exist.
  it('refuses an unknown or empty tab, leaving the fallback to the caller', () => {
    expect(resolveLegacyTab('nonsense')).toBeNull();
    expect(resolveLegacyTab('')).toBeNull();
    expect(resolveLegacyTab(null)).toBeNull();
    expect(resolveLegacyTab(undefined)).toBeNull();
  });
});

describe('resolveView', () => {
  it('reads the current parameter', () => {
    expect(resolveView(params('view=partager'))).toBe('partager');
  });

  it('falls back to a legacy tab, so a bookmark still lands somewhere real', () => {
    expect(resolveView(params('tab=enrichment'))).toBe('comprendre');
    expect(resolveView(params('tab=report'))).toBe('partager');
  });

  it('prefers view over tab when a URL carries both', () => {
    expect(resolveView(params('tab=enrichment&view=outils'))).toBe('outils');
  });

  it('falls back to Explorer for an empty, absent or nonsensical URL', () => {
    expect(resolveView(params(''))).toBe(DEFAULT_VIEW);
    expect(resolveView(null)).toBe(DEFAULT_VIEW);
    expect(resolveView(params('view=elsewhere'))).toBe(DEFAULT_VIEW);
    expect(resolveView(params('tab=nonsense'))).toBe(DEFAULT_VIEW);
  });
});

describe('buildViewHref', () => {
  const base = '/projects/p1/comparisons/A_vs_B';

  it('writes the default view bare, like the tab switcher already omits its default', () => {
    expect(buildViewHref(base, 'explorer')).toBe(base);
  });

  it('names any other view', () => {
    expect(buildViewHref(base, 'comprendre')).toBe(`${base}?view=comprendre`);
  });

  it('anchors at a panel', () => {
    expect(buildViewHref(base, 'comprendre', 'network')).toBe(`${base}?view=comprendre#network`);
    expect(buildViewHref(base, 'explorer', 'genes')).toBe(`${base}#genes`);
  });

  it('treats a null panel as no anchor', () => {
    expect(buildViewHref(base, 'outils', null)).toBe(`${base}?view=outils`);
  });

  it('round-trips through resolveView for every view', () => {
    for (const view of VIEW_ORDER) {
      const href = buildViewHref(base, view);
      const query = href.includes('?') ? href.slice(href.indexOf('?') + 1) : '';
      expect(resolveView(params(query))).toBe(view);
    }
  });
});

describe('upgradeLegacyQuery', () => {
  it('leaves a URL with no legacy tab alone, so the tidy-up writes no history entry', () => {
    expect(upgradeLegacyQuery(params(''))).toBeNull();
    expect(upgradeLegacyQuery(params('view=outils'))).toBeNull();
    expect(upgradeLegacyQuery(null)).toBeNull();
  });

  it('replaces tab with view and leaves no residue', () => {
    const upgraded = upgradeLegacyQuery(params('tab=enrichment'));
    expect(upgraded).toBe('view=comprendre');
    expect(upgraded).not.toContain('tab');
  });

  it('writes nothing at all when the target is the default view', () => {
    expect(upgradeLegacyQuery(params('tab=deg'))).toBe('');
    expect(upgradeLegacyQuery(params('tab=overview'))).toBe('');
  });

  it('drops an unknown tab rather than honouring it', () => {
    expect(upgradeLegacyQuery(params('tab=nonsense'))).toBe('');
  });

  it('preserves unrelated parameters, thresholds included', () => {
    const upgraded = upgradeLegacyQuery(params('tab=enrichment&padj=0.01&datasetId=abc'));
    const result = new URLSearchParams(upgraded ?? '');
    expect(result.get('view')).toBe('comprendre');
    expect(result.get('padj')).toBe('0.01');
    expect(result.get('datasetId')).toBe('abc');
    expect(result.has('tab')).toBe(false);
  });

  it('never mutates its input', () => {
    const original = params('tab=enrichment');
    upgradeLegacyQuery(original);
    expect(original.get('tab')).toBe('enrichment');
  });

  it('leaves every legacy tab in a state resolveView agrees with', () => {
    for (const tab of EVERY_LEGACY_TAB) {
      const upgraded = upgradeLegacyQuery(params(`tab=${tab}`));
      expect(resolveView(params(upgraded ?? ''))).toBe(resolveLegacyTab(tab)!.view);
    }
  });
});
