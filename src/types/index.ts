export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  species: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  page_size: number;
}

export enum DatasetType {
  MATRIX = 'MATRIX',
  METADATA = 'METADATA',
  METADATA_SAMPLE = 'METADATA_SAMPLE',
  METADATA_CONTRAST = 'METADATA_CONTRAST',
  DEG = 'DEG',
  ENRICHMENT = 'ENRICHMENT'
}

export enum DatasetStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  FAILED = 'FAILED',
  ARCHIVED = 'ARCHIVED'
}

export interface Dataset {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  type: DatasetType;
  status: DatasetStatus;
  created_at: string;
  updated_at: string;
  error_message?: string;
  dataset_metadata?: Record<string, unknown>;
  raw_file_path?: string;
  column_mapping?: Record<string, string>;
}

export interface DatasetQueryResponse {
  columns: string[];
  data: Record<string, unknown>[];
  total_rows: number;
  returned_rows: number;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  subscription_plan: string;
  ai_interpretations_used: number;
  ai_tokens_purchased: number;
  ai_tokens_used: number;
  full_name?: string;
}

export interface EnrichmentResult {
  id: string;
  pathway_id: string;
  pathway_name: string;
  category: string;
  description?: string;
  gene_count: number;
  pvalue: number;
  padj: number;
  gene_ratio?: string;
  bg_ratio?: string;
  regulation: string;
  genes?: string[];
}

export interface GOTreeNode {
  go_id: string;
  go_name: string;
  namespace: string;
  level: number | null;
  is_enriched: boolean;
  pvalue?: number | null;
  fdr?: number | null;
  enrichment_ratio?: number | null;
  gene_count?: number | null;
  genes?: string[];
  children: GOTreeNode[];
}

export interface GOHierarchyResponse {
  biological_process: GOTreeNode[];
  molecular_function: GOTreeNode[];
  cellular_component: GOTreeNode[];
}

export interface DailyLoginCount {
  date: string;
  count: number;
}

export interface RecentLoginEvent {
  user_id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export interface LoginStatsResponse {
  daily_counts: DailyLoginCount[];
  active_today: number;
  active_7_days: number;
  active_30_days: number;
  recent_events: RecentLoginEvent[];
}

// ---------------------------------------------------------------------------
// Self-service DESeq2 analyses
// ---------------------------------------------------------------------------

export enum SelfServiceAnalysisStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export type OmicsDataType = 'transcriptomics' | 'proteomics' | 'lipidomics';

export interface AnalysisParams {
  design: 'auto' | 'condition' | 'batch_condition';
  fdr: number;
  min_log2fc: number;
  min_reads: number;
  min_genes: number;
  min_count: number;
  min_reps: number;
  threads: number;
  enrichment_databases?: string[] | null;
  species?: string;
}

export interface ProgressLogEntry {
  step: string;
  message?: string;
  timestamp: string;
}

export interface SelfServiceAnalysis {
  id: string;
  project_id: string;
  name: string;
  data_type: OmicsDataType;
  status: SelfServiceAnalysisStatus;
  matrix_dataset_id: string | null;
  samples_dataset_id: string | null;
  comparisons_dataset_id: string | null;
  params: AnalysisParams;
  result_dataset_ids: string[];
  intermediate_dataset_ids: { vst?: string; normalized?: string; umap?: string };
  celery_task_id: string | null;
  current_step: string | null;
  progress_log: ProgressLogEntry[];
  error_message: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SelfServiceAnalysisCreate {
  project_id: string;
  name: string;
  data_type: OmicsDataType;
  matrix_dataset_id: string;
  samples_dataset_id: string;
  comparisons_dataset_id: string;
  params: AnalysisParams;
}

export interface SelfServiceAnalysisListResponse {
  items: SelfServiceAnalysis[];
  total: number;
}


