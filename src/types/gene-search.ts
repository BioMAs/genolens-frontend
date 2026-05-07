/**
 * Type definitions for Gene Search.
 */

export interface GeneSearchResult {
  gene_symbol: string;
  gene_id?: string;
  project_id: string;
  project_name: string;
  dataset_id: string;
  dataset_name: string;
  dataset_type: string;
  comparison_name?: string;
  log_fc?: number;
  padj?: number;
  regulation?: string;
  base_mean?: number;
}

export interface GeneSearchResponse {
  results: GeneSearchResult[];
  total: number;
  query: string;
}
