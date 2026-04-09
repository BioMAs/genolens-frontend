/**
 * Types for project activity history
 */

export type ActivityEventType =
  | 'dataset_uploaded'
  | 'dataset_deleted'
  | 'comparison_created'
  | 'enrichment_run'
  | 'clustering_run'
  | 'gsea_run'
  | 'go_enrichment_run'
  | 'bookmark_created'
  | 'bookmark_batch_created'
  | 'bookmark_deleted'
  | 'gene_list_created'
  | 'comment_added'
  | 'project_shared';

export interface ActivityLogEntry {
  id: string;
  project_id: string;
  user_id: string;
  event_type: ActivityEventType;
  entity_type?: string;
  entity_id?: string;
  entity_name?: string;
  extra_metadata: Record<string, any>;
  created_at: string;
}

export interface ActivityLogListResponse {
  items: ActivityLogEntry[];
  total: number;
  limit: number;
  offset: number;
}
