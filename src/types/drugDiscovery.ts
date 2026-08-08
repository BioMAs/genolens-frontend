/**
 * Réponses du module Drug Discovery (`/api/v1/drug-discovery/*`).
 *
 * Les formes viennent de genolens-dd et sont traversées telles quelles par le backend.
 * `subscores` est indexé par nom d'axe (disease, dependency, tractability, novelty, safety,
 * genetic) et une valeur peut être `null` : l'axe n'a pas été mesuré pour ce gène, ce qui
 * n'est pas la même chose qu'un zéro.
 */

export interface DdIndication {
  tcga_project: string;
  disease_name: string;
  excluded: boolean;
  /** Motif curé, non nul dès que `excluded` l'est. */
  rationale: string | null;
}

export interface DdIndicationsResponse {
  indications: DdIndication[];
  profiles: string[];
}

export interface DdStatus {
  configured: boolean;
  reachable: boolean | null;
  ready: boolean | null;
  tables?: Record<string, string>;
  detail?: string;
}

export interface DdTarget {
  gene_id: string;
  symbol: string;
  composite: number;
  rank: number;
  percentile: number;
  /** Toujours rendue : un composite sans sa couverture est trompeur. */
  coverage: number;
  n_axes_scored: number;
  subscores: Record<string, number | null>;
}

export interface DdTargetsResponse {
  run_id: string;
  n_ranked: number;
  n_excluded_insufficient_evidence: number;
  n_disqualified_common_essential: number;
  n_disqualified_safety_floor: number;
  n_excluded_missing_required_axis: number;
  missing_required_by_axis: Record<string, number>;
  targets: DdTarget[];
}

export interface DdRunDetail {
  run_id: string;
  profile: string;
  weights: Record<string, number>;
  weights_hash: string;
  min_axes: number;
  /** Non vide sur un run forcé : le classement ne porte alors aucun axe maladie. */
  warnings: string[];
  required_axes: string[];
  safety_floor: number | null;
  axis_versions: Record<string, string>;
  source_releases: Record<string, string>;
  n_genes_in_universe: number;
  indication: string | null;
  include_chembl_derived: boolean;
  attributions: DdAttribution[];
}

export interface DdAttribution {
  source: string;
  name: string;
  release: string;
  licence: string;
  text: string;
  needs_counsel_signoff: boolean;
}

export interface DdClaim {
  text: string;
  template: string;
  template_version: string;
  evidence_ids: string[];
}

export interface DdReport {
  run_id: string;
  indication: string;
  profile: string;
  weights_hash: string;
  source_releases: Record<string, string>;
  attributions: string[];
  /** > 0 signifie que des cibles du top ont été écartées faute de preuve. Absent en mode B. */
  n_targets_without_evidence?: number;
  sections: { title: string; claims: DdClaim[] }[];
  bibliography: string[];
  appendix: string[];
  /** Mode B uniquement : projet à l'origine de la signature. `null`/absent en mode A. */
  client_id?: string | null;
  /**
   * Mode B uniquement. `validate_report` refuse en amont un rapport client sans état de
   * divulgation déclaré ; ne pas les rendre ici laisserait tomber cette discipline au dernier
   * mètre, là où elle est justement destinée à être lue.
   */
  disclosures?: string[] | null;
  n_hits_total?: number;
  n_hits_reported?: number;
}

export interface DdRunParams {
  indication: string;
  profile: string;
  allowExcluded: boolean;
}

/* ------------------------------------------------------------------ */
/* Mode B — confronter une comparaison de l'utilisateur au classement   */
/* ------------------------------------------------------------------ */

export type DdSignatureDirection = 'both' | 'up' | 'down';

/**
 * D'où vient l'effectif de réplicats. Affiché, parce que « 4 réplicats lus dans la feuille
 * d'échantillons » et « 4 réplicats que vous avez saisis » n'engagent pas la même confiance.
 */
export type DdReplicatesSource =
  | 'analysis_samplesheet'
  | 'project_samplesheet'
  | 'user'
  | 'unknown';

export interface DdSignatureCondition {
  name: string;
  direction: 'UP' | 'DOWN';
  n_genes: number;
  /** Nombre de DEG avant plafonnement : distinct de `n_genes` pour rendre la troncature lisible. */
  n_available: number;
  truncated: boolean;
  replicates: number | null;
  replicates_source: DdReplicatesSource;
  /**
   * Symboles réellement envoyés pour ce bras. Présent sur la réponse d'un run, absent du
   * preview : c'est le relevé de ce qui est parti, et c'est la seule source correcte pour la
   * colonne Direction — la déduire autrement serait une supposition.
   */
  genes?: string[];
}

export interface DdSignaturePreview {
  dataset_id: string;
  comparison_name: string;
  conditions: DdSignatureCondition[];
  needs_replicates: boolean;
  species: string | null;
  warnings: string[];
}

export interface DdSignatureResult {
  /** Mêmes colonnes qu'en mode A : le mode B lit le classement, il ne le recalcule pas. */
  hits: DdTarget[];
  /**
   * Gènes résolus mais absents du classement — plancher de sécurité, essentiels communs, axe
   * requis manquant. **À ne jamais fondre dans `unresolved`** : les deux appellent des actions
   * différentes de la part de l'utilisateur.
   */
  outside_universe: string[];
  n_hits: number;
  n_outside_universe: number;
  /** `null` quand l'intersection est vide : rendre un nombre inventerait une mesure. */
  mean_percentile: number | null;
  pvalue: number | null;
  confidence: 'normal' | 'low';
  seed: number;
  n_permutations: number;
  matched_expression: boolean;
  disclosures: string[];
  /** Nommés, jamais seulement comptés. */
  unresolved: string[];
  corrected: string[];
  n_input: number;
  n_resolved: number;
  signature_id: string;
  n_targets_without_expression_level?: number;
}

export interface DdSignatureRunResponse {
  run_id: string;
  indication: string;
  profile: string;
  signature: {
    conditions: DdSignatureCondition[];
    genes_sent_total: number;
    warnings: string[];
  };
  result: DdSignatureResult;
}

/** Rejet codé par règle (SIG001…SIG006) renvoyé tel quel par genolens-dd. */
export interface DdSignatureRejection {
  rule_id: string;
  conditions: string[];
  rule?: string;
  message?: string;
}

export interface DdSignatureFilters {
  padjMax: number;
  logfcMin: number;
  directions: DdSignatureDirection;
  maxGenesPerCondition: number;
  seed: number;
}

export interface DdSignatureRunParams extends DdSignatureFilters {
  datasetId: string;
  comparisonName: string;
  indication: string;
  profile: string;
  allowExcluded: boolean;
  replicates: Record<string, number>;
  allowUnderpowered: boolean;
}
