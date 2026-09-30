/**
 * Which grouping column the comparison builder starts on.
 *
 * R groups samples by the first of condition/group/treatment/genotype present in
 * the sample sheet — in that alias order, whatever the file order. The builder had
 * its own list ("groupe", "name") and took the first match in file order, so it
 * could build comparisons on a column the pipeline never reads.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import ContrastBuilder from '@/components/wizard/ContrastBuilder';

jest.mock('@/hooks/useDatasets', () => ({ useDatasetQuery: jest.fn() }));
jest.mock('@/utils/api', () => ({ __esModule: true, default: { post: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useDatasetQuery } = require('@/hooks/useDatasets');

function renderWith(rows: Record<string, string>[]) {
  useDatasetQuery.mockReturnValue({
    data: { columns: Object.keys(rows[0]), data: rows },
    isLoading: false,
    isError: false,
  });
  render(<ContrastBuilder projectId="p" samplesDatasetId="s" samplesReady onBuilt={jest.fn()} />);
}

// Removed with the column now being sent at launch; kept to prove it stays gone.
const MISMATCH = 'condition-column-mismatch';

beforeEach(() => jest.clearAllMocks());

it('starts on the column R uses, in alias order rather than file order', () => {
  renderWith([
    { sample_id: 'S1', treatment: 'drug', condition: 'ctrl' },
    { sample_id: 'S2', treatment: 'none', condition: 'ko' },
  ]);
  expect(screen.getByText('2 conditions detected: ctrl, ko')).toBeInTheDocument();
  expect(screen.queryByTestId(MISMATCH)).not.toBeInTheDocument();
});

it('matches aliases case-insensitively', () => {
  renderWith([
    { SampleID: 'S1', Genotype: 'wt' },
    { SampleID: 'S2', Genotype: 'mut' },
  ]);
  expect(screen.getByText('2 conditions detected: wt, mut')).toBeInTheDocument();
  expect(screen.queryByTestId(MISMATCH)).not.toBeInTheDocument();
});

it('never warns about the picked column: it is sent to the pipeline at launch', () => {
  renderWith([
    { sample: 'S1', treatment: 'drug', cohort: 'a' },
    { sample: 'S2', treatment: 'none', cohort: 'b' },
  ]);
  // Pre-selects the alias column the pipeline would have guessed…
  expect(screen.getByText('2 conditions detected: drug, none')).toBeInTheDocument();
  // …and the user may switch to any column without being told the analysis will fail.
  fireEvent.click(screen.getByRole('button', { name: /^treatment/ }));
  fireEvent.click(screen.getByText('cohort', { selector: 'div' }));
  expect(screen.getByText('2 conditions detected: a, b')).toBeInTheDocument();
  expect(screen.queryByTestId(MISMATCH)).not.toBeInTheDocument();
});

it('pre-selects "groupe", which the pipeline now recognises', () => {
  renderWith([
    { sample: 'S1', groupe: 'a' },
    { sample: 'S2', groupe: 'b' },
  ]);
  expect(screen.getByText('2 conditions detected: a, b')).toBeInTheDocument();
});
