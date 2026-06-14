export type ReportJobStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export interface ReportJob {
  id: string;
  project_id: string;
  analysis_id: string | null;
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
