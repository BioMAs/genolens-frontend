/**
 * The reading's URL contract: the parts it names, the focus views it opens, and where every URL
 * the comparison page ever produced now lands.
 *
 * The mapping is asserted **driven by the panel list itself** (`COMPARISON_PANELS`), like the
 * legacy-tab table before it: adding a panel without a destination fails here, not in a user's
 * saved link.
 */
import {
  COMPARISON_PANELS,
  type ComparisonPanel,
} from '@/components/comparison/comparisonRoutes';
import {
  FOCUS_KINDS,
  partDomId,
  READING_PARTS,
  readingHref,
  readingLocation,
  resolveReadingTarget,
  type FocusKind,
  type ReadingTarget,
} from '@/components/reading/readingRoutes';

const ALL_COMPARISON_PANELS = COMPARISON_PANELS;

const params = (query: string) => new URLSearchParams(query);

/** The destination of each old panel, spelled out — `Record` makes the compiler enforce the list. */
const EXPECTED: Record<ComparisonPanel, ReadingTarget> = {
  summary: { part: 'answers', focus: null, report: false },
  genes: { part: 'counts', focus: null, report: false },
  heatmap: { part: 'counts', focus: 'heatmap', report: false },
  methods: { part: 'counts', focus: 'methods', report: false },
  'external-lookup': { part: 'counts', focus: 'lookup', report: false },
  'custom-viz': { part: 'counts', focus: 'charts', report: false },
  ai: { part: 'meaning', focus: null, report: false },
  enrichment: { part: 'processes', focus: null, report: false },
  network: { part: 'genes', focus: 'network', report: false },
  'drug-discovery': { part: 'targets', focus: null, report: false },
  cosmomics: { part: 'skin', focus: null, report: false },
  cosmetics: { part: 'skin', focus: null, report: false },
  signature: { part: 'signature', focus: null, report: false },
  exports: { part: 'genes', focus: 'table', report: false },
  // L'éditeur de mise en page du rapport : l'ancien onglet « Report » avait ce module.
  report: { part: 'answers', focus: 'report', report: false },
};

describe('the reading parts', () => {
  it('names the nine parts, in reading order, with the labels the page shows', () => {
    expect(READING_PARTS.map((p) => [p.id, p.label])).toEqual([
      ['answers', 'Answers'],
      ['counts', 'Gene counts'],
      ['genes', 'Top genes'],
      ['processes', 'Processes'],
      ['meaning', 'Meaning'],
      ['applications', 'Applications'],
      ['targets', 'Drug targets'],
      ['skin', 'Skin claims'],
      ['signature', 'Signature score'],
    ]);
  });

  it('numbers the five questions 1 to 5 and nests the three applications under Applications', () => {
    const byId = Object.fromEntries(READING_PARTS.map((p) => [p.id, p]));
    expect(
      READING_PARTS.filter((p) => p.number !== undefined).map((p) => [p.id, p.number])
    ).toEqual([
      ['counts', 1],
      ['genes', 2],
      ['processes', 3],
      ['meaning', 4],
      ['applications', 5],
    ]);
    expect(READING_PARTS.filter((p) => p.parent).map((p) => p.id)).toEqual([
      'targets',
      'skin',
      'signature',
    ]);
    expect(READING_PARTS.filter((p) => p.parent).every((p) => p.parent === 'applications')).toBe(
      true
    );
    expect(byId.answers.number).toBeUndefined();
    expect(byId.applications.parent).toBeUndefined();
  });

  it('gives every part its own DOM id, prefixed part-', () => {
    expect(partDomId('processes')).toBe('part-processes');
    const ids = READING_PARTS.map((p) => partDomId(p.id));
    expect(new Set(ids).size).toBe(READING_PARTS.length);
  });
});

describe('legacy URLs', () => {
  it.each(ALL_COMPARISON_PANELS)('maps ?panel=%s to a reading part', (panel) => {
    const t = resolveReadingTarget(new URLSearchParams({ panel }), '');
    expect(READING_PARTS.map((p) => p.id)).toContain(t.part);
  });

  it('lists every panel the compiler knows (the table below is exhaustive)', () => {
    expect([...ALL_COMPARISON_PANELS].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(Object.entries(EXPECTED))('sends ?panel=%s to its reading target', (panel, target) => {
    expect(resolveReadingTarget(params(`panel=${panel}`), '')).toEqual(target);
  });

  it('ignores the old screen when a panel is named', () => {
    expect(resolveReadingTarget(params('view=partager&panel=genes'), '')).toEqual({
      part: 'counts',
      focus: null,
      report: false,
    });
  });

  it('keeps the GSEA fragment as the gsea focus', () =>
    expect(resolveReadingTarget(params('view=comprendre&panel=enrichment'), '#gsea')).toEqual({
      part: 'processes',
      focus: 'gsea',
      report: false,
    }));

  it('reads a bare #gsea bookmark and a legacy ?tab=enrichment#gsea alike', () => {
    const gsea = { part: 'processes', focus: 'gsea', report: false };
    expect(resolveReadingTarget(params(''), '#gsea')).toEqual(gsea);
    expect(resolveReadingTarget(params('tab=enrichment'), '#gsea')).toEqual(gsea);
  });

  it('keeps #gsea to the processes: on another panel it opens nothing', () =>
    expect(resolveReadingTarget(params('panel=network'), '#gsea')).toEqual({
      part: 'genes',
      focus: 'network',
      report: false,
    }));

  it('reads legacy ?tab= and the outils alias', () => {
    expect(resolveReadingTarget(params('tab=cosmetics'), '').part).toBe('skin');
    expect(resolveReadingTarget(params('view=outils'), '').part).toBe('targets');
  });

  it('reads the fragments of the scrolling layout', () => {
    expect(resolveReadingTarget(params(''), '#cosmetics').part).toBe('skin');
    expect(resolveReadingTarget(params(''), '#genes').part).toBe('counts');
  });

  it.each([
    ['view=explorer', 'answers', null],
    ['view=comprendre', 'meaning', null],
    ['view=appliquer', 'targets', null],
    ['view=outils', 'targets', null],
    ['view=partager', 'answers', 'report'],
  ] as const)('sends the bare screen %s to %s (focus: %s)', (query, part, focus) => {
    expect(resolveReadingTarget(params(query), '')).toEqual({ part, focus, report: false });
  });

  it('opens the report layout for the old Share screen, not the report scroll', () =>
    expect(resolveReadingTarget(params('view=partager'), '')).toEqual({
      part: 'answers',
      focus: 'report',
      report: false,
    }));

  it('defaults to the answers', () =>
    expect(resolveReadingTarget(new URLSearchParams(), '')).toEqual({
      part: 'answers',
      focus: null,
      report: false,
    }));

  it('falls back to the answers on a hand-edited URL', () => {
    expect(resolveReadingTarget(params('view=nope&panel=nope&tab=nope'), '#nope')).toEqual({
      part: 'answers',
      focus: null,
      report: false,
    });
  });
});

describe('the canonical form', () => {
  it('reads its own canonical form back', () =>
    expect(resolveReadingTarget(params('focus=claims'), '#part-skin')).toEqual({
      part: 'skin',
      focus: 'claims',
      report: false,
    }));

  it('reads ?report=1 as the report, on the answers', () =>
    expect(resolveReadingTarget(params('report=1'), '')).toEqual({
      part: 'answers',
      focus: null,
      report: true,
    }));

  it('reads a focus on the answers, which carry no fragment', () =>
    expect(resolveReadingTarget(params('focus=volcano'), '')).toEqual({
      part: 'answers',
      focus: 'volcano',
      report: false,
    }));

  it('reads a bare #part- fragment', () =>
    expect(resolveReadingTarget(params(''), '#part-targets')).toEqual({
      part: 'targets',
      focus: null,
      report: false,
    }));

  it('lets the new form win over the old one', () =>
    expect(
      resolveReadingTarget(params('view=partager&panel=genes&tab=signature&focus=table'), '#part-genes')
    ).toEqual({ part: 'genes', focus: 'table', report: false }));

  it('ignores an unknown focus', () => {
    expect(resolveReadingTarget(params('focus=nope'), '#part-skin')).toEqual({
      part: 'skin',
      focus: null,
      report: false,
    });
    // Without anything else new, an unknown focus leaves the old reading in charge.
    expect(resolveReadingTarget(params('focus=nope&panel=network'), '')).toEqual({
      part: 'genes',
      focus: 'network',
      report: false,
    });
  });

  it('falls back to the legacy reading on an unknown #part-', () =>
    expect(resolveReadingTarget(params('panel=signature'), '#part-nope')).toEqual({
      part: 'signature',
      focus: null,
      report: false,
    }));

  it('has thirteen focus views, the report layout among them', () => {
    expect(FOCUS_KINDS).toHaveLength(13);
    expect(FOCUS_KINDS).toContain('report');
  });

  it('reads every part and every focus it writes', () => {
    const focuses: FocusKind[] = [...FOCUS_KINDS];
    for (const { id } of READING_PARTS) {
      for (const focus of [null, ...focuses]) {
        const target: ReadingTarget = { part: id, focus, report: false };
        const { search, hash } = readingLocation(target, params(''));
        expect(resolveReadingTarget(params(search), hash)).toEqual(target);
      }
    }
  });

  // `?report=1` reste lu, pour les liens qui le portent, mais plus rien ne l'écrit.
  it('reads ?report=1 but never writes it back', () => {
    for (const { id } of READING_PARTS) {
      const { search } = readingLocation({ part: id, focus: null, report: true }, params(''));
      expect(search).toBe('');
    }
  });
});

describe('readingLocation', () => {
  it('writes the canonical form and keeps explorer state', () =>
    expect(
      readingLocation(
        { part: 'processes', focus: 'gsea', report: false },
        params('view=comprendre&panel=enrichment&padj=0.01&gene=IL6')
      )
    ).toEqual({ search: '?padj=0.01&gene=IL6&focus=gsea', hash: '#part-processes' }));

  it('drops view, panel and tab, and anything it does not own', () =>
    expect(
      readingLocation(
        { part: 'counts', focus: null, report: false },
        params('view=appliquer&panel=genes&tab=deg&utm_source=mail&foo=bar')
      )
    ).toEqual({ search: '', hash: '#part-counts' }));

  it('keeps padj, lfc, gene, geneList and datasetId in their original order', () =>
    expect(
      readingLocation(
        { part: 'genes', focus: null, report: false },
        params('datasetId=d1&geneList=IL6%2CTNF&gene=IL6&lfc=1&padj=0.05')
      )
    ).toEqual({
      search: '?datasetId=d1&geneList=IL6%2CTNF&gene=IL6&lfc=1&padj=0.05',
      hash: '#part-genes',
    }));

  it('appends the focus after the kept state, and never the report', () =>
    expect(
      readingLocation(
        { part: 'targets', focus: 'targets', report: true },
        params('padj=0.01')
      )
    ).toEqual({ search: '?padj=0.01&focus=targets', hash: '#part-targets' }));

  it('writes no fragment for the answers, and an empty search when nothing remains', () =>
    expect(
      readingLocation({ part: 'answers', focus: null, report: false }, params('view=partager'))
    ).toEqual({ search: '', hash: '' }));

  it('replaces a focus or report already in the current URL rather than doubling it', () =>
    expect(
      readingLocation(
        { part: 'answers', focus: null, report: false },
        params('padj=0.01&focus=volcano&report=1')
      )
    ).toEqual({ search: '?padj=0.01', hash: '' }));
});

describe('readingHref', () => {
  it('encodes a comparison name with spaces, + and /', () =>
    expect(readingHref('p1', 'UVB 24 h + active vs UVB/2')).toBe(
      '/projects/p1/comparisons/UVB%2024%20h%20%2B%20active%20vs%20UVB%2F2'
    ));

  it('leaves a plain name readable', () =>
    expect(readingHref('p1', 'treated_vs_control')).toBe(
      '/projects/p1/comparisons/treated_vs_control'
    ));
});
