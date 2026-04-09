/**
 * Types for project dashboard statistics
 */

export interface DatasetBreakdown {
  matrix: number;
  deg: number;
  enrichment: number;
  metadata: number;
  other: number;
}

export interface ActivityBreakdown {
  datasets_uploaded: number;
  bookmarks_created: number;
  comments_added: number;
  analyses_run: number;
}

export interface ProjectDashboardStats {
  project_id: string;
  project_name: string;

  // Datasets
  total_datasets: number;
  datasets_ready: number;
  datasets_processing: number;
  datasets_failed: number;
  dataset_breakdown: DatasetBreakdown;

  // Analysis output
  total_comparisons: number;
  total_deg_genes: number;
  total_enrichment_pathways: number;

  // Collaboration
  total_bookmarks: number;
  total_gene_lists: number;
  total_comments: number;
  total_members: number;

  // Activity
  total_activity_events: number;
  activity_last_7_days: ActivityBreakdown;
  last_activity_at: string | null;
}
