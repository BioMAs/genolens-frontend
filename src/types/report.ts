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

export type FirstPageType = "detailed" | "simple" | "cover";
export type LastPageType = "color" | "contact";

/** Project / cover information shown on the report's first (and contact) page. */
export interface CoverInfo {
  project_name?: string | null;
  client_ref?: string | null;
  sponsor_name?: string | null;
  sponsor_contact?: string | null;
  sponsor_email?: string | null;
  sponsor_address?: string | null;
  test_facility_name?: string | null;
  test_facility_contact?: string | null;
  test_facility_email?: string | null;
  test_facility_address?: string | null;
  test_site_name?: string | null;
  test_site_contact?: string | null;
  test_site_email?: string | null;
  test_site_address?: string | null;
  prepared_by?: string | null;
  checked_by?: string | null;
  approved_by?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
}

/** Per-report editable content + layout overrides (report customization module). */
export interface ComparisonReportTriggerPayload {
  conclusion?: string;
  materials_methods?: string;
  first_page_type?: FirstPageType;
  last_page_type?: LastPageType;
  cover_info?: CoverInfo;
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
  first_page_type: FirstPageType;
  last_page_type: LastPageType;
  cover_info: CoverInfo | null;
}
