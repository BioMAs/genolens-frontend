/**
 * CosmOmics Pathway Nova — payload of
 * GET /datasets/{datasetId}/comparisons/{comparison}/cosmomics-nova.
 *
 * `nl` is always −log10(p): p of the term (adjusted), or the unsigned Stouffer
 * combination of its terms for a sub-group (a combined p, not an adjusted one).
 *
 * Every field the backend added when the nova started to state what it computed
 * (`state`, `n_balanced`, `not_evaluated`, `status`, `provenance`, …) is optional
 * here: the reference fixture and older payloads do not carry them, and the view
 * then derives what it can and says nothing it does not know.
 */

export type NovaDirection = 'up' | 'down';

/** Which side of its claim a sub-group stands on; `balanced` = the evidence cancels (delta 0). */
export type NovaSide = 'for' | 'against' | 'balanced';

/** What a claim's evidence looks like: only for it, only against it, or both. */
export type NovaClaimState = 'for_only' | 'against_only' | 'both_ways';

export interface NovaTerm {
  id: string;
  label: string;
  nl: number;
  /** +1 supports the claim, −1 contradicts it, 0 not linked to any claim. */
  effect: 1 | -1 | 0;
  obs: NovaDirection;
  /** The term is enriched in the up list and in the down list (one entry per direction). */
  both_directions?: boolean;
  /** Adjusted p below alpha. A term that is not still weighs in the sums. */
  significant?: boolean;
}

export interface NovaSubgroup {
  name: string;
  /** −log10 of the combined (Stouffer) p of its terms. */
  nl: number;
  s_pro: number;
  s_anti: number;
  delta: number;
  balance: number;
  obs: NovaDirection;
  n_terms_both_directions?: number;
  terms: NovaTerm[];
}

export interface NovaClaim {
  name: string;
  state?: NovaClaimState;
  importance: number;
  s_pro: number;
  s_anti: number;
  coherence: number;
  n_for: number;
  n_against: number;
  /** Sub-groups whose evidence for and against cancels: counted neither for nor against. */
  n_balanced?: number;
  /** The most significant sub-group, whatever its direction. */
  best_subgroup?: string;
  best_nl?: number;
  /** The most significant sub-group among those that go for the claim (null without one). */
  best_for_subgroup?: string | null;
  best_for_nl?: number | null;
  subgroups: NovaSubgroup[];
}

export interface NovaCoverage {
  n_terms: number;
  n_terms_significant: number;
  n_terms_matched: number;
  /** Stored terms at p ≥ alpha: they still weigh in the sums. */
  n_terms_not_significant?: number;
  /** Terms left out because they carry no adjusted p. */
  n_terms_without_padj?: number;
}

/** What the nova was computed from. `enrichment_fdr` null means "not recorded". */
export interface NovaProvenance {
  dataset_id: string | null;
  comparison: string;
  enrichment_dataset_ids: string[];
  analysis_id: string | null;
  enrichment_fdr: number | null;
  enrichment_databases: string[] | null;
  padj_columns: string[];
  source_versions: string[];
  referential_version: number | null;
  alpha: number;
  app_version?: string;
  generated_at: string;
  /** The dataset is a demonstration dataset: its exports are marked DEMO. */
  demo: boolean;
}

export interface CosmOmicsNovaData {
  /** "no_enrichment": the comparison has no directional enrichment rows to read. */
  status?: 'ok' | 'no_enrichment';
  contrast: string;
  /** Name in the central disc (numerator of the contrast). */
  condition?: string;
  alpha?: number;
  /** What the term p-values are, in words (adjusted p of GenoLens enrichment, or of uploaded tables). */
  p_source?: string;
  /** Ordered by S_pro, strongest first — the sector order. */
  claims: NovaClaim[];
  /** Claims of the referential with no significant term in this comparison. */
  not_evaluated?: string[];
  unlinked: NovaSubgroup[];
  /** Significant not-linked sub-groups before the display cap. */
  unlinked_total?: number;
  coverage?: NovaCoverage;
  provenance?: NovaProvenance;
}

/**
 * An AI reading of the nova, as saved (GET …/interpretation) or just written
 * (POST …/interpret). `stale`: written from other data than the nova of today.
 */
export interface CosmOmicsInterpretation {
  interpretation: string;
  cached: boolean;
  stale?: boolean;
  model: string;
  generated_at: string | null;
  inputs_sha256?: string | null;
  /** How many of the nova's claims the prompt carried, out of `claims_total`. */
  claims_sent?: number;
  claims_total?: number;
  /** Former name of `claims_total`. */
  claims_count?: number | null;
}
