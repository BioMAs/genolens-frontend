/**
 * Dashboard "Jump back in": the CosmOmics read replaced the former Skin Stack.
 */
import { render, screen } from '@testing-library/react';
import JumpBackInCard from '@/components/dashboard/JumpBackInCard';
import mock from '@/components/cosmomics/cosmomicsNovaMock.json';

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
  expect(screen.getByText('CosmOmics verdict')).toBeInTheDocument();
  expect(screen.getByText('Regeneration, firming & barrier')).toBeInTheDocument();
  expect(screen.getByText('Regeneration · 7 for · 1 against')).toBeInTheDocument();
  expect(screen.getByText('87%')).toBeInTheDocument();
});

it('falls back to DEG counts without the add-on, and never queries the nova', () => {
  mockProfile.mockReturnValue({ data: { has_cosmetics_module: false } });
  render(<JumpBackInCard projectId="p1" />);

  expect(mockNova).toHaveBeenCalledWith('ds-1', 'UVB_vs_Sham', false);
  expect(screen.queryByText('CosmOmics verdict')).toBeNull();
  expect(screen.getByText('1,200 differentially expressed genes')).toBeInTheDocument();
});
