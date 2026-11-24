/**
 * La navigation d'un projet : quelles routes la portent, quel onglet est courant,
 * et ce qui est verrouille.
 *
 * L'enjeu de `isProjectLevelRoute` est ce qu'il refuse : la rangee d'onglets
 * recouvre le projet (apercu, preparation, analyses, multi-comparaison, nuage de
 * contrastes), pas ce qu'on ouvre DEPUIS le projet. Sur une analyse, une
 * comparaison ou un dataset, c'est le fil d'Ariane qui ramene en arriere.
 */
import {
  buildProjectNav,
  isProjectLevelRoute,
  resolveActiveProjectTab,
} from '@/lib/navigation/projectNav';
import { PLAN_GATE_COPY } from '@/utils/plan';

const SCIENCE_LOCK = 'Scientific tools add-on — ask an admin to enable it';

describe('isProjectLevelRoute', () => {
  it.each([
    '/projects/p1',
    '/projects/p1/',
    '/projects/p1/setup',
    '/projects/p1/analyses',
    '/projects/p1/analyses/',
    '/projects/p1/analyses/new',
    '/projects/p1/multi-comparison',
    '/projects/p1/contrast-scatter',
  ])('is true on %s', (pathname) => {
    expect(isProjectLevelRoute(pathname)).toBe(true);
  });

  it.each([
    '/projects',
    '/projects/',
    '/dashboard',
    '/projects/p1/analyses/a1',
    '/projects/p1/analyses/a1/comparisons/Lesional_vs_Non-lesional',
    '/projects/p1/comparisons/Lesional_vs_Non-lesional',
    '/projects/p1/datasets/d1',
    // Pas de sous-route inventee : un prefixe ne suffit pas.
    '/projects/p1/setup/extra',
    '/projects/p1/analyses/new/extra',
    '/projects/p1/multi-comparisons',
    '/projects/p1/contrast-scatter-old',
  ])('is false on %s', (pathname) => {
    expect(isProjectLevelRoute(pathname)).toBe(false);
  });
});

describe('resolveActiveProjectTab', () => {
  it.each([
    ['/projects/p1', 'overview'],
    ['/projects/p1/', 'overview'],
    ['/projects/p1/setup', 'setup'],
    ['/projects/p1/analyses', 'analyses'],
    ['/projects/p1/analyses/new', 'analyses'],
    // Une analyse reste dans la section Analyses, meme si la rangee n'y est pas rendue.
    ['/projects/p1/analyses/a1', 'analyses'],
    ['/projects/p1/analyses/a1/comparisons/A_vs_B', 'analyses'],
    ['/projects/p1/multi-comparison', 'multi'],
    ['/projects/p1/contrast-scatter', 'scatter'],
  ])('%s -> %s', (pathname, key) => {
    expect(resolveActiveProjectTab(pathname)).toBe(key);
  });

  it.each([
    '/dashboard',
    '/projects',
    '/projects/p1/comparisons/A_vs_B',
    '/projects/p1/datasets/d1',
  ])('%s belongs to no tab', (pathname) => {
    expect(resolveActiveProjectTab(pathname)).toBeNull();
  });
});

describe('buildProjectNav', () => {
  const open = { canMulti: true, canScatter: true };

  it('lists the five sections in order, with their labels and routes', () => {
    expect(buildProjectNav('p1', open).map(({ key, label, href }) => [key, label, href])).toEqual([
      ['overview', 'Overview', '/projects/p1'],
      ['setup', 'Setup', '/projects/p1/setup'],
      ['analyses', 'Analyses', '/projects/p1/analyses'],
      ['multi', 'Multi-comparison', '/projects/p1/multi-comparison'],
      ['scatter', 'Contrast scatter', '/projects/p1/contrast-scatter'],
    ]);
  });

  it('locks nothing when both gates are open', () => {
    expect(buildProjectNav('p1', open).every((item) => item.lockedReason === null)).toBe(true);
  });

  it('locks Multi-comparison on the plan entitlement, with the plan copy', () => {
    const items = buildProjectNav('p1', { canMulti: false, canScatter: true });
    expect(items.find((i) => i.key === 'multi')?.lockedReason).toBe(PLAN_GATE_COPY.multiComparison);
    expect(items.find((i) => i.key === 'scatter')?.lockedReason).toBeNull();
  });

  it('locks Contrast scatter on the add-on, with the add-on copy', () => {
    const items = buildProjectNav('p1', { canMulti: true, canScatter: false });
    expect(items.find((i) => i.key === 'scatter')?.lockedReason).toBe(SCIENCE_LOCK);
    expect(items.find((i) => i.key === 'multi')?.lockedReason).toBeNull();
  });

  it('never locks the three always-available sections', () => {
    const items = buildProjectNav('p1', { canMulti: false, canScatter: false });
    for (const key of ['overview', 'setup', 'analyses']) {
      expect(items.find((i) => i.key === key)?.lockedReason).toBeNull();
    }
  });
});
