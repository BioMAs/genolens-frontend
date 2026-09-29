/**
 * Step labels for the self-service analysis progress UI (StepLaunch,
 * AnalysisStatusCard).
 *
 * The keys below are the ones the worker actually writes, in
 * backend/app/worker/tasks.py (`run_self_service_analysis`). The previous map
 * listed keys the worker never sends (loading_data, running_deseq2, …), so every
 * real step fell through and users read the raw key "running pipeline".
 */
import { ANALYSIS_STEP_LABELS, analysisStepLabel } from '@/utils/analysisSteps';

const WORKER_STEPS = [
  'initializing',
  'running_pipeline',
  'pipeline_summary',
  'registering_results',
  'no_results_warning',
  'done',
  'failed',
];

describe('analysisStepLabel', () => {
  it.each(WORKER_STEPS)('has a written label for the worker step %s', (step) => {
    expect(ANALYSIS_STEP_LABELS[step]).toBeDefined();
    expect(analysisStepLabel(step)).toBe(ANALYSIS_STEP_LABELS[step]);
  });

  it('never shows a raw key for a known step', () => {
    for (const step of WORKER_STEPS) {
      expect(analysisStepLabel(step)).not.toMatch(/_/);
      expect(analysisStepLabel(step)).not.toBe(step);
    }
  });

  it('maps the steps users see most to readable labels', () => {
    expect(analysisStepLabel('initializing')).toBe('Preparing analysis');
    expect(analysisStepLabel('running_pipeline')).toBe('Running differential expression');
    expect(analysisStepLabel('registering_results')).toBe('Saving results');
    expect(analysisStepLabel('done')).toBe('Completed');
  });

  it('falls back to a readable sentence for an unknown key', () => {
    expect(analysisStepLabel('computing_go_enrichment')).toBe('Computing go enrichment');
    expect(analysisStepLabel('NEW-STEP')).toBe('New step');
  });

  it('returns an empty string for a missing step', () => {
    expect(analysisStepLabel(null)).toBe('');
    expect(analysisStepLabel(undefined)).toBe('');
    expect(analysisStepLabel('')).toBe('');
  });
});
