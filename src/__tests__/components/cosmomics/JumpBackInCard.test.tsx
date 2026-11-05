/**
 * Dashboard "Jump back in": the CosmOmics read replaced the former Skin Stack.
 */
import { render, screen } from '@testing-library/react';
import JumpBackInCard from '@/components/dashboard/JumpBackInCard';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';
import honest from '../../fixtures/cosmomics/honestNova.json';

const mockProfile = jest.fn();
const mockNova = jest.fn();

jest.mock('@/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfile() }));
jest.mock('@/hooks/useCosmOmicsNova', () => ({
  useCosmOmicsNova: (...args: unknown[]) => mockNova(...args),
}));
jest.mock('@/hooks/useProjectData', () => ({
  useProjectSummary: () => ({
    data: {
      comparisons: [
        { name: 'UVB_vs_Sham', dataset_id: 'ds-1', has_enrichment: true, deg_total: 1200, deg_up: 700, deg_down: 500 },
      ],
    },
  }),
}));

beforeEach(() => {
  mockNova.mockReset();
  mockNova.mockReturnValue({ data: mock });
});

it('shows the CosmOmics read for an account with the add-on', () => {
  mockProfile.mockReturnValue({ data: { has_cosmetics_module: true } });
  render(<JumpBackInCard projectId="p1" />);

  expect(mockNova).toHaveBeenCalledWith('ds-1', 'UVB_vs_Sham', true);
  expect(screen.getByText('Pathway evidence by claim')).toBeInTheDocument();
  expect(screen.getByText('6 claims with a significant pathway')).toBeInTheDocument();
  expect(screen.getByText('Regeneration · 7 for · 1 against')).toBeInTheDocument();
  expect(screen.getByText('87%')).toBeInTheDocument();
});

it('JumpBackInCard has no verdict', () => {
  mockProfile.mockReturnValue({ data: { has_cosmetics_module: true } });
  mockNova.mockReturnValue({ data: honest });
  const { container } = render(<JumpBackInCard projectId="p1" />);

  // States and counts, in words — no sentence that rules on the claims.
  expect(container.textContent).not.toMatch(/verdict/i);
  expect(screen.getByText('2 claims with a significant pathway')).toBeInTheDocument();
  expect(screen.getByText('1 for only · 1 for and against · 2 not evaluated')).toBeInTheDocument();
  expect(screen.getByText('Claim A · 2 for · 0 against')).toBeInTheDocument();
  expect(screen.getByText('Claim B · 1 for · 1 against · 1 balanced')).toBeInTheDocument();
});

it('JumpBackInCard derives the states of a payload that does not carry them', () => {
  mockProfile.mockReturnValue({ data: { has_cosmetics_module: true } });
  render(<JumpBackInCard projectId="p1" />);
  // The reference fixture has no `state`: each claim has evidence on both sides of its terms.
  expect(screen.getByText('6 for and against')).toBeInTheDocument();
});

it('falls back to DEG counts without the add-on, and never queries the nova', () => {
  mockProfile.mockReturnValue({ data: { has_cosmetics_module: false } });
  render(<JumpBackInCard projectId="p1" />);

  expect(mockNova).toHaveBeenCalledWith('ds-1', 'UVB_vs_Sham', false);
  expect(screen.queryByText('CosmOmics verdict')).toBeNull();
  expect(screen.getByText('1,200 differentially expressed genes')).toBeInTheDocument();
});
