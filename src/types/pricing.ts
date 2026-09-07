/**
 * Pricing grid types — mirror of the backend Pydantic schema in
 * `backend/app/core/pricing.py`.
 *
 * The grid served by `GET /pricing` is the single source of truth for plans,
 * quotas, entitlements and card copy. Do not hard-code a price, a quota or a
 * plan name in a component: the four tables that used to do that are exactly
 * what this replaces.
 */

/**
 * A quota or cap as the grid states it. `null` and `'unlimited'`/`'custom'`
 * all mean unlimited; `0` means none included, which is different. Always read
 * these through `resolveLimit()`.
 */
export type Limit = number | 'unlimited' | 'custom' | null;

/**
 * How AI interpretation is dispensed. Three-valued on purpose: a plan can grant
 * access while billing every act, which a boolean cannot express.
 */
export type AiInterpretationMode = 'none' | 'metered_a_la_carte' | 'quota';

/** `null` means unlimited. `0` means none included. */
export function resolveLimit(value: Limit | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (value === 'unlimited' || value === 'custom') return null;
  return value;
}

/**
 * Capability flags. A key being absent means "not stated at this level" —
 * which is not the same as stated `false`. Never infer access from a missing
 * key; if the grid does not state it, nothing enforces it.
 */
export interface Entitlements {
  differential_expression?: boolean;
  clustering_basic?: boolean;
  clustering_full?: boolean;
  enrichment_go_bp?: boolean;
  enrichment_go_kegg_reactome?: boolean;
  plot_export?: boolean;
  ai_interpretation?: AiInterpretationMode;
  knowledge_graph?: boolean | AiInterpretationMode;
  cross_project_comparison?: boolean;
  rest_api?: boolean;
  api_rate_limit_per_min?: number;
  sso_saml?: boolean;
  on_premise?: boolean;
  support?: string;
  multi_comparison?: boolean;
  advanced_export?: boolean;
  /* Add-on owned — present on an Addon, never on a Plan. */
  gsea?: boolean;
  gsea_leading_edge?: boolean;
  custom_gene_sets?: boolean;
  signature_score?: boolean;
  contrast_scatter?: boolean;
  deg_patterns?: boolean;
  report_customization?: boolean;
  cosmetic_claims?: boolean;
  drug_discovery?: boolean;
}

/**
 * One bullet on a public pricing card. A commercial promise, **not** an
 * entitlement: several current bullets are enforced by nothing. Render these;
 * read `entitlements` to decide access.
 */
export interface MarketingFeature {
  label: string;
  included: boolean;
}

export interface Plan {
  id: string;
  /** Display name. The technical id and the commercial name differ: the plan
   *  whose id is `TEAM` is sold as "Pro". Always render this, never the id. */
  name_fr: string;
  name_en: string;
  order: number;
  most_popular?: boolean;

  price_monthly?: number | null;
  price_annual?: number | null;
  price_monthly_equivalent?: number | null;
  pricing_display?: string | null;
  pricing_display_en?: string | null;
  billing?: Array<'monthly' | 'annual' | 'custom'>;
  commitment_months?: number;

  contrast_quota?: Limit;
  quota_period?: 'monthly' | 'annual';
  contrast_unit_price?: number | null;

  seats?: Limit;
  max_projects?: Limit;
  datasets_limit?: Limit;
  datasets_limit_per_project?: Limit;
  storage_mb_per_dataset?: Limit;
  raw_data_retention_months?: Limit;

  entitlements?: Entitlements;

  description_en?: string;
  engagement_en?: string;
  cta_label_en?: string;
  marketing_features?: MarketingFeature[];

  positioning_fr?: string;
  note?: string;
}

/** A module sold independently of the plan. */
export interface Addon {
  id: string;
  name_fr: string;
  name_en: string;
  order: number;
  /** The `User` boolean column that grants it (e.g. `scientific_module_enabled`). */
  module_flag: string;
  entitlements?: Entitlements;
  price_monthly?: number | null;
  price_annual?: number | null;
  pricing_display?: string | null;
  positioning_fr?: string;
  note?: string;
}

export interface Overage {
  policy: 'allow_and_bill' | 'block';
  hard_block: boolean;
  soft_warning_at_pct?: number | null;
  invoice_cadence?: string | null;
  note?: string | null;
}

export interface PricingGrid {
  version: string;
  status: string;
  currency: string;
  tax_mode: string;
  plans: Plan[];
  addons: Addon[];
  overage?: Overage;
}

/** Plans in display order. */
export function plansOrdered(grid: PricingGrid): Plan[] {
  return [...grid.plans].sort((a, b) => a.order - b.order);
}

/** Add-ons in display order. */
export function addonsOrdered(grid: PricingGrid): Addon[] {
  return [...grid.addons].sort((a, b) => a.order - b.order);
}

/** Look a plan up by id, tolerating case and unknown values. */
export function findPlan(grid: PricingGrid | undefined, planId?: string | null): Plan | undefined {
  if (!grid || !planId) return undefined;
  const key = planId.toUpperCase();
  return grid.plans.find((p) => p.id.toUpperCase() === key);
}

/**
 * Display name for a plan id, falling back to the id itself.
 *
 * This is what stops a paying Starter customer from being labelled "Free" on
 * the dashboard: there is one naming authority now, and it is the grid.
 */
export function planDisplayName(grid: PricingGrid | undefined, planId?: string | null): string {
  return findPlan(grid, planId)?.name_en ?? planId ?? '—';
}
