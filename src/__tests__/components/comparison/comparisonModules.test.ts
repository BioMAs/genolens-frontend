import {
  buildComparisonModules,
  countModuleStates,
  type ComparisonModule,
  type ComparisonModulesInput,
} from '@/components/comparison/comparisonModules';

const FULL_ACCESS: ComparisonModulesInput = {
  hasMatrix: true,
  hasEnrichmentFile: true,
  cosmeticsUnlocked: true,
  reportUnlocked: true,
  scienceUnlocked: true,
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

    expect(modules).toHaveLength(9);
    expect(modules.every((m) => m.state === 'ready')).toBe(true);
    expect(byId(modules, 'claim').tab).toBe('cosmetics');
    expect(byId(modules, 'reporting').tab).toBe('report');
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

    expect(countModuleStates(modules)).toEqual({ ready: 5, 'needs-data': 2, locked: 2 });
  });
});
