import {
  buildComparisonModules,
  countModuleStates,
  groupModulesByView,
  type ComparisonModule,
  type ComparisonModulesInput,
} from '@/components/comparison/comparisonModules';
import { VIEW_ORDER } from '@/components/comparison/comparisonRoutes';

const FULL_ACCESS: ComparisonModulesInput = {
  hasMatrix: true,
  hasEnrichmentFile: true,
  cosmeticsUnlocked: true,
  reportUnlocked: true,
  scienceUnlocked: true,
  drugDiscoveryUnlocked: true,
  stats: { degUp: 1860, degDown: 1150, degTotal: 3010 },
};

const byId = (modules: ComparisonModule[], id: string) => {
  const found = modules.find((m) => m.id === id);
  if (!found) throw new Error(`module ${id} missing from the catalogue`);
  return found;
};

describe('buildComparisonModules', () => {
  it('marks every module ready when the data and the add-ons are there', () => {
    const modules = buildComparisonModules(FULL_ACCESS);

    // 14: the AI reading and the exports gained catalogue entries of their own, custom-viz —
    // a valid ?tab= value nothing ever linked to — finally became reachable, the old
    // integrations tab split into a network module and a database-lookup one, and the overview
    // section was added once the hub started counting what each screen holds.
    expect(modules).toHaveLength(14);
    expect(modules.every((m) => m.state === 'ready')).toBe(true);
    expect(byId(modules, 'claim').tab).toBe('cosmetics');
    expect(byId(modules, 'reporting').tab).toBe('report');

    // Both halves of the old integrations tab still answer to its legacy key
    expect(byId(modules, 'network').tab).toBe('integrations');
    expect(byId(modules, 'external-lookup').tab).toBe('integrations');
    // and the two that never had a tab say so, rather than looking locked
    expect(byId(modules, 'ai').tab).toBeNull();
    expect(byId(modules, 'exports').tab).toBeNull();
  });

  it('explains what is missing when the project has no expression matrix', () => {
    const modules = buildComparisonModules({ ...FULL_ACCESS, hasMatrix: false });

    for (const id of ['clustering', 'signature']) {
      const entry = byId(modules, id);
      expect(entry.state).toBe('needs-data');
      expect(entry.hint).toBe('Needs an expression matrix');
      expect(entry.metric).toBeUndefined();
    }
  });

  it('keeps locked add-ons visible, with no tab to open and an add-on id to request', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      cosmeticsUnlocked: false,
      reportUnlocked: false,
    });

    expect(byId(modules, 'claim')).toMatchObject({
      state: 'locked',
      tab: null,
      addOnId: 'claim',
      hint: 'Add-on module',
    });
    expect(byId(modules, 'reporting')).toMatchObject({
      state: 'locked',
      tab: null,
      addOnId: 'reporting',
    });
  });

  it('locks the signature module when the scientific add-on is off', () => {
    const modules = buildComparisonModules({ ...FULL_ACCESS, scienceUnlocked: false });

    expect(byId(modules, 'signature')).toMatchObject({
      state: 'locked',
      tab: null,
      addOnId: 'science',
      hint: 'Add-on module',
    });
    // Locked wins over needs-data: no module, no point mentioning the matrix.
    const noMatrix = buildComparisonModules({
      ...FULL_ACCESS,
      scienceUnlocked: false,
      hasMatrix: false,
    });
    expect(byId(noMatrix, 'signature').state).toBe('locked');
  });

  it('drops GSEA from the enrichment metric without the scientific add-on', () => {
    expect(byId(buildComparisonModules(FULL_ACCESS), 'enrichment').metric).toContain('GSEA');

    const locked = buildComparisonModules({ ...FULL_ACCESS, scienceUnlocked: false });
    const enrichment = byId(locked, 'enrichment');
    // ORA stays open to everyone — the module itself is not an add-on.
    expect(enrichment.state).toBe('ready');
    expect(enrichment.tab).toBe('enrichment');
    expect(enrichment.metric).not.toContain('GSEA');
  });

  it('locks drug targets when the Drug Discovery add-on is off', () => {
    const modules = buildComparisonModules({ ...FULL_ACCESS, drugDiscoveryUnlocked: false });

    expect(byId(modules, 'drug-discovery')).toMatchObject({
      state: 'locked',
      tab: null,
      addOnId: 'drugdiscovery',
      hint: 'Add-on module',
    });
    // It is an add-on, not a plan feature: nothing about the data can unlock it.
    expect(byId(modules, 'drug-discovery').metric).toBeUndefined();
  });

  it('orders modules ready → needs-data → locked', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      hasMatrix: false,
      cosmeticsUnlocked: false,
      reportUnlocked: false,
    });

    const rank = { ready: 0, 'needs-data': 1, locked: 2 } as const;
    const ranks = modules.map((m) => rank[m.state]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(modules[modules.length - 1].state).toBe('locked');
  });

  it('reports the significant-gene count on the DEG module', () => {
    expect(byId(buildComparisonModules(FULL_ACCESS), 'deg').metric).toBe('3,010 significant genes');
    expect(
      byId(buildComparisonModules({ ...FULL_ACCESS, stats: { degUp: 1, degDown: 0, degTotal: 1 } }), 'deg').metric
    ).toBe('1 significant gene');
  });

  it('builds without stats — they arrive after the first render', () => {
    const modules = buildComparisonModules({ ...FULL_ACCESS, stats: null });

    expect(byId(modules, 'deg').state).toBe('ready');
    expect(byId(modules, 'deg').metric).toBe('Browse all genes');
  });
});

describe('countModuleStates', () => {
  it('counts each state for the summary line', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      hasMatrix: false,
      cosmeticsUnlocked: false,
      reportUnlocked: false,
    });

    // clustering, signature and custom-viz all need the matrix; claim and reporting are locked
    expect(countModuleStates(modules)).toEqual({ ready: 9, 'needs-data': 3, locked: 2 });
  });

  it('counts every add-on as locked when none is unlocked', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      cosmeticsUnlocked: false,
      reportUnlocked: false,
      scienceUnlocked: false,
      drugDiscoveryUnlocked: false,
    });

    // claim, reporting, signature, drug-discovery
    expect(countModuleStates(modules).locked).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Three-screen restructure
// ─────────────────────────────────────────────────────────────────────────────

describe('view assignment', () => {
  it('places every module in one of the four views', () => {
    for (const entry of buildComparisonModules(FULL_ACCESS)) {
      expect(VIEW_ORDER).toContain(entry.view);
      expect(entry.panel).toBeTruthy();
    }
  });

  it('assigns a panel unique to each module, so no two share an anchor', () => {
    const panels = buildComparisonModules(FULL_ACCESS).map((m) => m.panel);
    expect(new Set(panels).size).toBe(panels.length);
  });

  it('keeps the gene-level work together in Explore', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    for (const id of ['deg', 'metrics', 'clustering']) {
      expect(byId(modules, id).view).toBe('explorer');
    }
  });

  it('keeps Understand to what the genes mean together', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    expect(byId(modules, 'ai').view).toBe('comprendre');
    expect(byId(modules, 'enrichment').view).toBe('comprendre');
    expect(byId(modules, 'network').view).toBe('comprendre');
    expect(byId(modules, 'reporting').view).toBe('partager');
    expect(byId(modules, 'exports').view).toBe('partager');
  });

  // The three modules that turn this comparison into something else: a target ranking, a claim
  // set, a per-sample score. They are also the three business add-ons, which is why the screen
  // they used to share with a database lookup and a chart builder read as a billing bucket.
  it('sends the downstream applications to Apply', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    expect(byId(modules, 'drug-discovery').view).toBe('appliquer');
    expect(byId(modules, 'claim').view).toBe('appliquer');
    expect(byId(modules, 'signature').view).toBe('appliquer');
  });

  // Annotating a gene list and charting arbitrary genes are exploration whatever menu they
  // used to hang under — this is the misfiling the restructure set out to correct.
  it('moves the two plain tools back into Explorer', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    expect(byId(modules, 'external-lookup').view).toBe('explorer');
    expect(byId(modules, 'custom-viz').view).toBe('explorer');
  });

  // Its section always rendered; without a catalogue entry it was absent from the rail, the
  // sidebar and every per-screen count.
  it('gives the overview section a catalogue entry of its own', () => {
    const overview = byId(buildComparisonModules(FULL_ACCESS), 'overview');
    expect(overview.view).toBe('explorer');
    expect(overview.panel).toBe('summary');
    expect(overview.state).toBe('ready');
  });

  it('keeps a locked add-on in its view, with its tab and add-on id intact', () => {
    const modules = buildComparisonModules({ ...FULL_ACCESS, cosmeticsUnlocked: false });
    const claim = byId(modules, 'claim');

    expect(claim.state).toBe('locked');
    expect(claim.view).toBe('appliquer');
    expect(claim.panel).toBe('cosmetics');
    // the tab is withheld because no pane renders it, but the add-on stays requestable
    expect(claim.tab).toBeNull();
    expect(claim.addOnId).toBe('claim');
  });
});

describe('groupModulesByView', () => {
  it('returns the four views in their fixed order, even when one is empty', () => {
    const groups = groupModulesByView(buildComparisonModules(FULL_ACCESS));
    expect(groups.map((g) => g.view)).toEqual([...VIEW_ORDER]);
  });

  it('loses no module and duplicates none', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    const grouped = groupModulesByView(modules).flatMap((g) => g.modules);

    expect(grouped).toHaveLength(modules.length);
    expect(new Set(grouped.map((m) => m.id)).size).toBe(modules.length);
  });

  it('labels and describes every group', () => {
    for (const group of groupModulesByView(buildComparisonModules(FULL_ACCESS))) {
      expect(group.label).toBeTruthy();
      expect(group.description).toBeTruthy();
    }
  });

  // The point of bucketing rather than re-sorting: buildComparisonModules already ordered the
  // list ready -> needs-data -> locked, and preserving input order inherits that for free.
  it('inherits the ready-first order inside each group, with no second sort', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      hasMatrix: false,
      cosmeticsUnlocked: false,
      drugDiscoveryUnlocked: false,
    });
    const order = { ready: 0, 'needs-data': 1, locked: 2 } as const;

    for (const group of groupModulesByView(modules)) {
      const ranks = group.modules.map((m) => order[m.state]);
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it('preserves the same relative order the flat list had', () => {
    const modules = buildComparisonModules(FULL_ACCESS);
    const flatIndex = new Map(modules.map((m, i) => [m.id, i]));

    for (const group of groupModulesByView(modules)) {
      const indices = group.modules.map((m) => flatIndex.get(m.id)!);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
    }
  });

  it('counts states per group, not across the whole catalogue', () => {
    const modules = buildComparisonModules({
      ...FULL_ACCESS,
      cosmeticsUnlocked: false,
      drugDiscoveryUnlocked: false,
    });
    const groups = groupModulesByView(modules);
    const apply = groups.find((g) => g.view === 'appliquer')!;

    // claim and drug-discovery are locked here; the signature score is not
    expect(apply.counts.locked).toBe(2);
    expect(apply.counts.ready).toBe(1);

    for (const group of groups) {
      const summed = group.counts.ready + group.counts['needs-data'] + group.counts.locked;
      expect(summed).toBe(group.modules.length);
    }
  });

  it('survives an empty catalogue', () => {
    const groups = groupModulesByView([]);
    expect(groups).toHaveLength(VIEW_ORDER.length);
    expect(groups.every((g) => g.modules.length === 0)).toBe(true);
  });
});
