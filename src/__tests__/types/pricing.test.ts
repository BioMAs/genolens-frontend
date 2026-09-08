import {
  addonsOrdered,
  annualDiscountPct,
  findPlan,
  planDisplayName,
  plansOrdered,
  resolveLimit,
  type PricingGrid,
} from '@/types/pricing';

/**
 * Tests for the pricing grid helpers.
 *
 * The grid replaced four competing hard-coded plan tables in the frontend.
 * Two live defects came out of that duplication and are locked here:
 *
 *  - DashboardSubscriptionCard labelled every non-TEAM plan "Free", so a
 *    Starter customer paying €100/month was shown a free tier.
 *  - The same card treated a missing `max_projects` as unlimited, so a capped
 *    plan displayed ∞ whenever the field was absent — failing open on a limit.
 *    `resolveLimit` makes "unlimited" something the grid has to say.
 */

const grid: PricingGrid = {
  version: 'test',
  status: 'test',
  currency: 'EUR',
  tax_mode: 'HT',
  plans: [
    {
      id: 'TEAM',
      name_fr: 'Pro',
      name_en: 'Pro',
      order: 2,
      price_monthly: 250,
      max_projects: 'unlimited',
      contrast_quota: 150,
      entitlements: { ai_interpretation: 'quota' },
    },
    {
      id: 'STARTER',
      name_fr: 'Starter',
      name_en: 'Starter',
      order: 1,
      price_monthly: 100,
      max_projects: 15,
      contrast_quota: 30,
      entitlements: { ai_interpretation: 'none' },
    },
  ],
  addons: [
    { id: 'cosmetics', name_fr: 'c', name_en: 'c', order: 3, module_flag: 'cosmetics_module_enabled' },
    { id: 'scientific', name_fr: 's', name_en: 's', order: 1, module_flag: 'scientific_module_enabled' },
  ],
};

describe('resolveLimit', () => {
  it('treats unlimited and custom as no limit', () => {
    expect(resolveLimit('unlimited')).toBeNull();
    expect(resolveLimit('custom')).toBeNull();
    expect(resolveLimit(null)).toBeNull();
    expect(resolveLimit(undefined)).toBeNull();
  });

  it('keeps 0 distinct from unlimited', () => {
    // The Access tier of the target grid bundles zero contrasts and sells them
    // a la carte. Collapsing 0 to "unlimited" would give them away.
    expect(resolveLimit(0)).toBe(0);
  });

  it('passes real caps through', () => {
    expect(resolveLimit(15)).toBe(15);
  });
});

describe('ordering', () => {
  it('sorts plans by declared order, not array order', () => {
    expect(plansOrdered(grid).map((p) => p.id)).toEqual(['STARTER', 'TEAM']);
  });

  it('sorts addons by declared order', () => {
    expect(addonsOrdered(grid).map((a) => a.id)).toEqual(['scientific', 'cosmetics']);
  });

  it('does not mutate the grid', () => {
    plansOrdered(grid);
    expect(grid.plans[0].id).toBe('TEAM');
  });
});

describe('findPlan', () => {
  it('matches case-insensitively', () => {
    expect(findPlan(grid, 'starter')?.id).toBe('STARTER');
  });

  it('returns undefined rather than a wrong plan', () => {
    expect(findPlan(grid, 'lens_40')).toBeUndefined();
    expect(findPlan(grid, null)).toBeUndefined();
    expect(findPlan(undefined, 'STARTER')).toBeUndefined();
  });
});

describe('planDisplayName', () => {
  it('never calls a paying plan "Free"', () => {
    expect(planDisplayName(grid, 'STARTER')).toBe('Starter');
  });

  it('uses the commercial name, not the technical id', () => {
    // The plan whose id is TEAM is sold as "Pro".
    expect(planDisplayName(grid, 'TEAM')).toBe('Pro');
  });

  it('falls back to the id while the grid is loading', () => {
    expect(planDisplayName(undefined, 'TEAM')).toBe('TEAM');
    expect(planDisplayName(grid, undefined)).toBe('—');
  });
});

describe('project cap resolution (the fail-open regression)', () => {
  /** Mirrors ProjectsBar: unlimited only when the grid actually says so. */
  const capOf = (planId: string) => {
    const plan = findPlan(grid, planId);
    const gridMax = plan ? resolveLimit(plan.max_projects) : undefined;
    return { gridMax, unlimited: plan != null && gridMax === null };
  };

  it('reports a capped plan as capped', () => {
    expect(capOf('STARTER')).toEqual({ gridMax: 15, unlimited: false });
  });

  it('reports an uncapped plan as unlimited', () => {
    expect(capOf('TEAM')).toEqual({ gridMax: null, unlimited: true });
  });

  it('does not claim unlimited for an unknown plan', () => {
    // The old expression `plan !== 'STARTER' || max === null` returned true
    // here, showing ∞ for a plan it had never heard of.
    expect(capOf('mystery').unlimited).toBe(false);
  });
});

// ── annualDiscountPct ──────────────────────────────────────────────────────

/**
 * La page tarifaire annonçait « −17% » en dur. La valeur tenait tant que les
 * deux plans listés avaient la même remise annuelle ; l'alignement sur
 * genolens.com a cassé la coïncidence (Starter 15 %, Pro 20 %), rendant un
 * pourcentage unique faux pour au moins l'un des deux.
 */
describe('annualDiscountPct', () => {
  const withPrices = (prices: Array<[number | null, number | null]>): PricingGrid => ({
    ...grid,
    plans: prices.map(([monthly, annual], i) => ({
      ...grid.plans[0],
      id: `P${i}`,
      order: i,
      price_monthly: monthly,
      price_annual: annual,
    })),
  });

  it('retains the best discount across plans', () => {
    // Starter 1020/an contre 100/mois = 15 % ; Pro 2400 contre 250 = 20 %.
    expect(annualDiscountPct(withPrices([[100, 1020], [250, 2400]]))).toBe(20);
  });

  it('rounds to the nearest whole percent', () => {
    // 1000/1200 = 16,67 % — l'ancienne valeur écrite en dur.
    expect(annualDiscountPct(withPrices([[100, 1000]]))).toBe(17);
  });

  it('ignores a quoted plan that carries no price', () => {
    expect(annualDiscountPct(withPrices([[100, 1020], [null, null]]))).toBe(15);
  });

  it('ignores a plan priced monthly only', () => {
    expect(annualDiscountPct(withPrices([[100, null], [250, 2400]]))).toBe(20);
  });

  it('returns null when no plan has both prices, so the badge disappears', () => {
    // Plutôt que d'annoncer « up to −0% ».
    expect(annualDiscountPct(withPrices([[100, null], [null, null]]))).toBeNull();
  });

  it('returns null on an undefined grid', () => {
    expect(annualDiscountPct(undefined)).toBeNull();
  });

  it('never reports a negative discount when the annual price is the worse deal', () => {
    // Une grille mal saisie ne doit pas afficher « up to −-8% ».
    expect(annualDiscountPct(withPrices([[100, 1300]]))).toBeNull();
  });
});
