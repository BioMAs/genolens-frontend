/**
 * `GET /genes/search` — un gene DANS une comparaison, avec ses statistiques DEG.
 *
 * Miroir de `GeneSearchResult` cote backend (`app/api/endpoints/genes.py`). Chaque
 * resultat vient de la table `deg_genes` : la recherche ne renvoie jamais un gene que
 * la base ne contient pas.
 */

export interface GeneSearchResult {
  gene_id: string;
  /** Le symbole, ou l'identifiant quand l'ingestion n'a pas trouve de symbole. */
  gene_symbol: string;
  project_id: string;
  project_name: string;
  dataset_id: string;
  /** Present seulement quand le dataset vient d'une analyse qui existe encore. */
  analysis_id: string | null;
  analysis_name: string | null;
  comparison_name: string;
  log_fc: number | null;
  padj: number | null;
  /** `UP`, `DOWN` ou `NS`, tel que classe a l'ingestion. */
  regulation: string | null;
  /** Vrai quand le symbole ou l'identifiant est exactement la requete. */
  exact: boolean;
}

export interface GeneSearchResponse {
  results: GeneSearchResult[];
  total: number;
  query: string;
}
