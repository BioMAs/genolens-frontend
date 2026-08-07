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
  /** > 0 signifie que des cibles du top ont été écartées faute de preuve. */
  n_targets_without_evidence: number;
  sections: { title: string; claims: DdClaim[] }[];
  bibliography: string[];
  appendix: string[];
}

export interface DdRunParams {
  indication: string;
  profile: string;
  allowExcluded: boolean;
}
