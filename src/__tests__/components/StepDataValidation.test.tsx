/**
 * The wizard's "Data Validation & QC" step: which banner shows, and when
 * "Continue" is disabled. The checks themselves are covered in
 * lib/dataValidation.test.ts.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import StepDataValidation from '@/components/wizard/steps/StepDataValidation';
import { Dataset, DatasetStatus } from '@/types';

jest.mock('@/hooks/useProjectData', () => ({ useProjectDatasets: jest.fn() }));
jest.mock('@/hooks/useDatasets', () => ({ useDatasetQuery: jest.fn() }));
jest.mock('@/components/QCDashboard', () => function QCDashboard() {
  return <div data-testid="qc-dashboard" />;
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useProjectDatasets } = require('@/hooks/useProjectData');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useDatasetQuery } = require('@/hooks/useDatasets');

const SAMPLES = ['S1', 'S2', 'S3', 'S4'];

type SheetQuery = {
  data?: { columns: string[]; data: Record<string, unknown>[] };
  isError: boolean;
};

function dataset(id: string, meta: Record<string, unknown> = {}, status = DatasetStatus.READY): Dataset {
  return { id, name: `${id}.tsv`, status, dataset_metadata: meta } as unknown as Dataset;
}

function matrixMeta(overrides: Record<string, unknown> = {}) {
  return {
    n_genes: 20000,
    n_samples: 4,
    sample_names: SAMPLES,
    lib_sizes: Object.fromEntries(SAMPLES.map(s => [s, 2e7])),
    detected_genes: Object.fromEntries(SAMPLES.map(s => [s, 15000])),
    min_lib_size: 2e7,
    min_detected_genes: 15000,
    ...overrides,
  };
}

function sampleSheet(ids = SAMPLES, conditions = ['ctrl', 'ctrl', 'trt', 'trt']): SheetQuery {
  return {
    data: {
      columns: ['sample_id', 'condition'],
      data: ids.map((s, i) => ({ sample_id: s, condition: conditions[i] })),
    },
    isError: false,
  };
}

function setup({
  meta = matrixMeta(),
  sheet = sampleSheet(),
  matrixStatus = DatasetStatus.READY,
}: { meta?: Record<string, unknown>; sheet?: SheetQuery; matrixStatus?: DatasetStatus } = {}) {
  useProjectDatasets.mockReturnValue({
    data: [dataset('m', meta, matrixStatus), dataset('s')],
  });
  useDatasetQuery.mockReturnValue(sheet);
  const onContinue = jest.fn();
  render(
    <StepDataValidation
      projectId="p"
      matrixDatasetId="m"
      samplesDatasetId="s"
      onContinue={onContinue}
      onBack={jest.fn()}
    />,
  );
  return { onContinue, continueButton: screen.getByRole('button', { name: /continue to settings/i }) };
}

const PASSED = /all checks passed/i;

beforeEach(() => jest.clearAllMocks());

it('shows "All checks passed" for clean files, and continues', () => {
  const { onContinue, continueButton } = setup();
  expect(screen.getByText(PASSED)).toBeInTheDocument();
  expect(screen.queryByText(/warning/i)).not.toBeInTheDocument();
  fireEvent.click(continueButton);
  expect(onContinue).toHaveBeenCalled();
});

it('queries the sample sheet only once it is ready', () => {
  setup();
  expect(useDatasetQuery).toHaveBeenCalledWith('s', 10000, true);
});

it('warns about a sample with fewer than 500 detected genes', () => {
  const { continueButton } = setup({
    meta: matrixMeta({ detected_genes: { S1: 15000, S2: 300, S3: 15000, S4: 15000 } }),
  });
  expect(screen.getByText('1 sample with fewer than 500 detected genes')).toBeInTheDocument();
  expect(screen.getByText(/S2 \(300\)/)).toBeInTheDocument();
  expect(screen.queryByText(PASSED)).not.toBeInTheDocument();
  expect(continueButton).toBeEnabled();
});

it('warns about a sample with fewer than 100,000 reads', () => {
  const { continueButton } = setup({
    meta: matrixMeta({ lib_sizes: { S1: 2e7, S2: 2e7, S3: 42000, S4: 2e7 } }),
  });
  expect(screen.getByText('1 sample with fewer than 100,000 reads')).toBeInTheDocument();
  expect(screen.getByText(/S3 \(42,000\)/)).toBeInTheDocument();
  expect(continueButton).toBeEnabled();
});

it('warns about fewer than 4 samples', () => {
  const three = ['S1', 'S2', 'S3'];
  const { continueButton } = setup({
    meta: matrixMeta({
      n_samples: 3,
      sample_names: three,
      lib_sizes: { S1: 2e7, S2: 2e7, S3: 2e7 },
      detected_genes: { S1: 15000, S2: 15000, S3: 15000 },
    }),
    sheet: sampleSheet(three, ['ctrl', 'ctrl', 'trt']),
  });
  expect(screen.getByText('Only 3 samples in the count matrix')).toBeInTheDocument();
  // "trt" has a single sample too.
  expect(screen.getByText('1 condition has fewer than 2 samples')).toBeInTheDocument();
  expect(screen.getByText('2 warnings')).toBeInTheDocument();
  expect(continueButton).toBeEnabled();
});

it('warns about matrix columns missing from the sample sheet', () => {
  const { continueButton } = setup({ sheet: sampleSheet(['S1', 'S2', 'S3'], ['ctrl', 'ctrl', 'trt']) });
  expect(screen.getByText('1 matrix column is not in the sample sheet')).toBeInTheDocument();
  expect(continueButton).toBeEnabled();
});

it('warns about sample-sheet entries missing from the matrix', () => {
  const { continueButton } = setup({
    sheet: sampleSheet([...SAMPLES, 'S5', 'S6'], ['ctrl', 'ctrl', 'trt', 'trt', 'trt', 'ctrl']),
  });
  expect(screen.getByText('2 sample-sheet entries have no column in the count matrix')).toBeInTheDocument();
  expect(continueButton).toBeEnabled();
});

it('warns when the sample sheet has no recognised sample-ID or condition column', () => {
  setup({
    sheet: {
      data: { columns: ['name', 'groupe'], data: SAMPLES.map(s => ({ name: s, groupe: 'x' })) },
      isError: false,
    },
  });
  expect(screen.getByText('No sample ID column in the sample sheet')).toBeInTheDocument();
  expect(screen.getByText('No condition column in the sample sheet')).toBeInTheDocument();
  expect(screen.queryByText(PASSED)).not.toBeInTheDocument();
  expect(screen.queryByText(/some checks could not run/i)).not.toBeInTheDocument();
});

it('warns about conditions with fewer than 2 samples', () => {
  setup({ sheet: sampleSheet(SAMPLES, ['ctrl', 'ctrl', 'ctrl', 'trt']) });
  expect(screen.getByText('1 condition has fewer than 2 samples')).toBeInTheDocument();
  expect(screen.getByText(/trt \(1\)/)).toBeInTheDocument();
});

it('blocks Continue when no sample matches between the two files', () => {
  const { onContinue, continueButton } = setup({ sheet: sampleSheet(['A', 'B', 'C', 'D']) });
  expect(screen.getByRole('alert')).toHaveTextContent('No sample in the count matrix matches the sample sheet');
  expect(continueButton).toBeDisabled();
  fireEvent.click(continueButton);
  expect(onContinue).not.toHaveBeenCalled();
});

it('does not claim success when the matrix has no QC metrics', () => {
  setup({ meta: { rows: 20000, columns: 5 } });
  expect(screen.queryByText(PASSED)).not.toBeInTheDocument();
  expect(screen.getByText(/some checks could not run/i)).toBeInTheDocument();
});

it('does not claim success while the matrix is still processing', () => {
  setup({ matrixStatus: DatasetStatus.PROCESSING });
  expect(screen.queryByText(PASSED)).not.toBeInTheDocument();
});

it('says so when the sample sheet cannot be read', () => {
  setup({ sheet: { isError: true } });
  expect(screen.queryByText(PASSED)).not.toBeInTheDocument();
  expect(screen.getByText(/sample sheet could not be read/i)).toBeInTheDocument();
});
