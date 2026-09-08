/**
 * `UsageSection` porte les chiffres d'usage sur la page de compte.
 *
 * Elle rend le même `QuotaMeters` que le dashboard, en colonne : une seule
 * autorité et un seul rendu, donc aucune chance que les deux surfaces
 * annoncent des chiffres différents — ce qui était le cas quand `/profile`
 * lisait la grille tarifaire et le dashboard la charge utile d'abonnement.
 */
import { render, screen } from '@testing-library/react';

import UsageSection from '@/app/profile/UsageSection';
import type { QuotaState } from '@/hooks/useQuotas';

jest.mock('@/hooks/useQuotas', () => ({
  ...jest.requireActual('@/hooks/useQuotas'),
  useQuotas: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useQuotas } = require('@/hooks/useQuotas');

const STATE: QuotaState = {
  comparisons: { used: 6, max: 30, remaining: 24, unlimited: false },
  projects: { used: 4, max: 15, remaining: 11, unlimited: false },
  ai: { credits: 18, unlimited: false },
  maxDatasetsPerProject: 5,
  resetsOn: new Date(2026, 9, 1),
  tone: 'ok',
  isLoading: false,
  hasProfile: true,
  isError: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  useQuotas.mockReturnValue(STATE);
});

it('titles the section', () => {
  render(<UsageSection />);
  expect(screen.getByRole('heading', { name: /usage & quotas/i })).toBeInTheDocument();
});

it('shows what is left, from the same source as the dashboard', () => {
  render(<UsageSection />);
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent('24');
  expect(screen.getByTestId('quota-projects')).toHaveTextContent('4');
  expect(screen.getByTestId('quota-ai')).toHaveTextContent('18');
});

it('stacks the meters rather than laying them in a row', () => {
  const { container } = render(<UsageSection />);
  expect(container.querySelector('[data-layout="column"]')).toBeInTheDocument();
});
