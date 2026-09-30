/**
 * The wizard's "Explore Enrichment" link opens enrichment that exists.
 *
 * It used to open `/datasets/<result_dataset_ids[0]>/enrichment?databases=…&fdr=…`. The first
 * result id is a DEG dataset — the ids alternate DEG, ENRICHMENT — while the pathways live under
 * the ENRICHMENT dataset, so the page came up empty; and the page never read the query string.
 */
import { render, screen } from '@testing-library/react';
import { DatasetStatus, DatasetType } from '@/types';
import StepResults from '@/components/wizard/steps/StepResults';
import { DEFAULT_CLUSTERING } from '@/components/wizard/steps/StepAnalysisSettings';

const mockAnalysis = jest.fn();
const mockDatasets = jest.fn();
jest.mock('@/hooks/useAnalyses', () => ({
  useAnalysis: () => ({ data: mockAnalysis() }),
}));
jest.mock('@/hooks/useProjectData', () => ({
  useProjectSummary: () => ({ data: { comparisons: [] } }),
  useProjectDatasets: () => ({ data: mockDatasets() }),
}));

const ds = (id: string, type: DatasetType, comparison: string) => ({
  id,
  project_id: 'p-1',
  name: id,
  type,
  status: DatasetStatus.READY,
  dataset_metadata: { comparison_name: comparison },
});

// The order the worker registers them in: each comparison's DEG dataset, then its enrichment.
const DATASETS = [
  ds('deg-1', DatasetType.DEG, 'A_vs_B'),
  ds('enr-1', DatasetType.ENRICHMENT, 'A_vs_B'),
  ds('deg-2', DatasetType.DEG, 'A_vs_C'),
  ds('enr-2', DatasetType.ENRICHMENT, 'A_vs_C'),
  ds('deg-3', DatasetType.DEG, 'B_vs_C'), // no enrichment dataset: nothing was enriched
];

function renderStep() {
  render(
    <StepResults
      projectId="p-1"
      analysisId="an-1"
      matrixDatasetId="m-1"
      clusteringConfig={DEFAULT_CLUSTERING}
      onRunNew={jest.fn()}
    />
  );
}

const enrichmentLinks = () => screen.queryAllByRole('link', { name: /explore enrichment/i });

beforeEach(() => {
  mockAnalysis.mockReturnValue({
    id: 'an-1',
    result_dataset_ids: DATASETS.map((d) => d.id),
    params: { fdr: 0.05, min_log2fc: 0.585, enrichment_fdr: 0.01 },
  });
  mockDatasets.mockReturnValue(DATASETS);
});

it('links each enriched comparison to its Understand screen, at the enrichment panel', () => {
  renderStep();
  expect(enrichmentLinks().map((a) => a.getAttribute('href'))).toEqual([
    '/projects/p-1/comparisons/A_vs_B?view=comprendre#enrichment',
    '/projects/p-1/comparisons/A_vs_C?view=comprendre#enrichment',
  ]);
});

it('never opens the dataset enrichment page of a DEG dataset', () => {
  renderStep();
  for (const a of enrichmentLinks()) {
    expect(a.getAttribute('href')).not.toMatch(/\/datasets\//);
    expect(a.getAttribute('href')).not.toMatch(/[?&](fdr|databases)=/);
  }
});

it('encodes comparison names', () => {
  mockDatasets.mockReturnValue([ds('enr-x', DatasetType.ENRICHMENT, 'KO 1/WT')]);
  mockAnalysis.mockReturnValue({ id: 'an-1', result_dataset_ids: ['enr-x'], params: {} });
  renderStep();
  expect(enrichmentLinks()[0].getAttribute('href')).toBe(
    '/projects/p-1/comparisons/KO%201%2FWT?view=comprendre#enrichment'
  );
});

it('states the term cut-off the analysis ran with', () => {
  renderStep();
  expect(screen.getByText(/terms kept at adj\. p-value < 0\.01/i)).toBeInTheDocument();
});

// Analyses launched before the wizard sent the field ran at the R script's 0.05.
it('falls back to 0.05 for analyses that predate the field', () => {
  mockAnalysis.mockReturnValue({
    id: 'an-1',
    result_dataset_ids: DATASETS.map((d) => d.id),
    params: { fdr: 0.05, min_log2fc: 1 },
  });
  renderStep();
  expect(screen.getByText(/terms kept at adj\. p-value < 0\.05/i)).toBeInTheDocument();
});

it('offers no link when the analysis produced no enrichment', () => {
  mockDatasets.mockReturnValue(DATASETS.filter((d) => d.type === DatasetType.DEG));
  renderStep();
  expect(enrichmentLinks()).toHaveLength(0);
  expect(screen.getByText(/no enrichment results yet/i)).toBeInTheDocument();
});
