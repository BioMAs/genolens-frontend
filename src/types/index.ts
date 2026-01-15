export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
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
  dataset_metadata?: any;
  raw_file_path?: string;
}

export interface DatasetQueryResponse {
  columns: string[];
  data: Record<string, any>[];
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


