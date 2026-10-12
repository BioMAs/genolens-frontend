/**
 * CosmOmics Pathway Nova — payload of
 * GET /datasets/{datasetId}/comparisons/{comparison}/cosmomics-nova.
 *
 * `nl` is always −log10(p): p of the term (adjusted), or the unsigned Stouffer
 * combination of its terms for a sub-group.
 */

export type NovaDirection = 'up' | 'down';

export interface NovaTerm {
  id: string;
  label: string;
  nl: number;
  /** +1 supports the claim, −1 contradicts it, 0 not linked to any claim. */
  effect: 1 | -1 | 0;
  obs: NovaDirection;
}

export interface NovaSubgroup {
  name: string;
  nl: number;
  s_pro: number;
  s_anti: number;
  delta: number;
  balance: number;
  obs: NovaDirection;
  terms: NovaTerm[];
}

export interface NovaClaim {
  name: string;
  importance: number;
  s_pro: number;
  s_anti: number;
  coherence: number;
  n_for: number;
  n_against: number;
  best_subgroup?: string;
  best_nl?: number;
  subgroups: NovaSubgroup[];
}

export interface CosmOmicsNovaData {
  contrast: string;
  /** Name in the central disc ("Active" by default). */
  condition?: string;
  alpha?: number;
  p_source?: string;
  /** Ordered by S_pro, strongest first — the sector order. */
  claims: NovaClaim[];
  unlinked: NovaSubgroup[];
  /** Significant not-linked sub-groups before the display cap. */
  unlinked_total?: number;
  coverage?: { n_terms: number; n_terms_significant: number; n_terms_matched: number };
}

export interface CosmOmicsInterpretation {
  interpretation: string;
  cached: boolean;
  model: string;
  claims_count: number;
  generated_at: string | null;
}
