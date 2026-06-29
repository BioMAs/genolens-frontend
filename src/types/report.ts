export type ReportJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ReportJob {
  id: string;
  project_id: string;
  analysis_id: string | null;
  dataset_id: string | null;
  comparison_name: string | null;
  celery_task_id: string | null;
  status: ReportJobStatus;
  pdf_path: string | null;
  error_message: string | null;
  requested_by: string;
  created_at: string;
  updated_at: string;
}

export interface ReportTriggerResponse {
  job_id: string;
  status: ReportJobStatus;
  message: string;
}

/** Per-report editable content (report customization module). */
export interface ComparisonReportTriggerPayload {
  conclusion?: string;
  materials_methods?: string;
}

/** Persistent per-user report branding settings. */
export interface ReportSettings {
  logo_path: string | null;
  institute_name: string | null;
  institute_address: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  default_materials_methods: string | null;
  default_conclusion: string | null;
}
