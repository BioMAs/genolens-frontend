/**
 * Human-readable labels for self-service analysis steps.
 *
 * The keys are the values `run_self_service_analysis` writes to
 * `current_step` and to each `progress_log` entry, in
 * backend/app/worker/tasks.py. The launch step used to map a set of keys the
 * worker never sends (loading_data, running_deseq2, …), so every real step fell
 * through to the raw key and users read "running pipeline".
 */
export const ANALYSIS_STEP_LABELS: Record<string, string> = {
  initializing: 'Preparing analysis',
  running_pipeline: 'Running differential expression',
  pipeline_summary: 'Pipeline summary',
  registering_results: 'Saving results',
  no_results_warning: 'No results produced',
  done: 'Completed',
  failed: 'Failed',
};

/**
 * Label for a step key. An unknown key (a step added on the worker before the
 * UI knows it) is still shown readably: underscores become spaces and the first
 * letter is capitalised, so `computing_go_enrichment` reads "Computing go
 * enrichment" rather than the bare identifier.
 */
export function analysisStepLabel(step: string | null | undefined): string {
  if (!step) return '';
  const known = ANALYSIS_STEP_LABELS[step];
  if (known) return known;
  const words = step.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
