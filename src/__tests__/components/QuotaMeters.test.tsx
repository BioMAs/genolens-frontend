/**
 * `QuotaMeters` est la réponse à « qu'est-ce qu'il me reste ». Il est rendu en
 * position primaire sur le dashboard, en colonne sur /profile.
 *
 * Il affiche le nombre **restant**, pas le nombre utilisé : c'est la question
 * que se pose l'utilisateur, et l'ancienne carte y répondait en « utilisé /
 * quota » sous le libellé « Analyses / month ».
 */
import { render, screen } from '@testing-library/react';
import QuotaMeters from '@/components/QuotaMeters';
import type { QuotaState } from '@/hooks/useQuotas';

jest.mock('@/hooks/useQuotas', () => ({
  ...jest.requireActual('@/hooks/useQuotas'),
  useQuotas: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useQuotas } = require('@/hooks/useQuotas');

function state(overrides: Partial<QuotaState> = {}): QuotaState {
  return {
    comparisons: { used: 6, max: 30, remaining: 24, unlimited: false },
    projects: { used: 4, max: 15, remaining: 11, unlimited: false },
    ai: { credits: 18, unlimited: false },
    maxDatasetsPerProject: 5,
    resetsOn: new Date(2026, 9, 1),
    tone: 'ok',
    isLoading: false,
    hasProfile: true,
    isError: false,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

it('leads with the number of comparisons left, not the number used', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaMeters />);

  const cell = screen.getByTestId('quota-comparisons');
  expect(cell).toHaveTextContent('24');
  expect(cell).toHaveTextContent(/of 30/i);
  expect(cell).toHaveTextContent(/comparisons left/i);
});

it('names the month the quota resets', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaMeters />);
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent(/resets/i);
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent(/october/i);
});

it('shows the project usage against its cap', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaMeters />);
  expect(screen.getByTestId('quota-projects')).toHaveTextContent('4');
  expect(screen.getByTestId('quota-projects')).toHaveTextContent('15');
});

it('shows AI credits', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaMeters />);
  expect(screen.getByTestId('quota-ai')).toHaveTextContent('18');
});

it('renders infinity instead of a meter when unlimited', () => {
  useQuotas.mockReturnValue(
    state({
      comparisons: { used: 120, max: null, remaining: null, unlimited: true },
      projects: { used: 30, max: null, remaining: null, unlimited: true },
      ai: { credits: null, unlimited: true },
    })
  );
  render(<QuotaMeters />);

  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent('∞');
  expect(screen.getByTestId('quota-ai')).toHaveTextContent(/unlimited/i);
});

it('offers an upgrade link as soon as the tone is low', () => {
  useQuotas.mockReturnValue(
    state({
      comparisons: { used: 25, max: 30, remaining: 5, unlimited: false },
      tone: 'low',
    })
  );
  render(<QuotaMeters />);

  expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/pricing');
});

it('offers an upgrade link when exhausted', () => {
  useQuotas.mockReturnValue(
    state({
      comparisons: { used: 30, max: 30, remaining: 0, unlimited: false },
      tone: 'exhausted',
    })
  );
  render(<QuotaMeters />);

  expect(screen.getByRole('link', { name: /upgrade/i })).toBeInTheDocument();
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent(/no comparison left/i);
});

it('offers no upgrade link while the tone is ok', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaMeters />);
  expect(screen.queryByRole('link', { name: /upgrade/i })).not.toBeInTheDocument();
});

// ── état de chargement ─────────────────────────────────────────────────────

it('renders placeholders while loading', () => {
  useQuotas.mockReturnValue(state({ isLoading: true, hasProfile: false }));
  render(<QuotaMeters />);
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent('—');
});

it('offers no upgrade link while loading', () => {
  // Le ton dérivé d'un profil absent vaudrait « exhausted » (max 0, reste 0) :
  // sans garde, chaque chargement du dashboard afficherait un CTA « Upgrade »
  // et un chiffre rouge à un utilisateur qui n'a rien épuisé.
  useQuotas.mockReturnValue(
    state({
      isLoading: true,
      hasProfile: false,
      comparisons: { used: 0, max: 0, remaining: 0, unlimited: false },
      projects: { used: 0, max: 0, remaining: 0, unlimited: false },
      ai: { credits: 0, unlimited: false },
      tone: 'exhausted',
    })
  );
  render(<QuotaMeters />);

  expect(screen.queryByRole('link', { name: /upgrade/i })).not.toBeInTheDocument();
  expect(screen.getByTestId('quota-comparisons')).toHaveTextContent('—');
  expect(screen.getByTestId('quota-comparisons')).not.toHaveTextContent(/no comparison left/i);
});

it('renders placeholders rather than a free allowance when the profile never arrived', () => {
  useQuotas.mockReturnValue(
    state({
      isLoading: false,
      hasProfile: false,
      isError: true,
      ai: { credits: 15, unlimited: false },
    })
  );
  render(<QuotaMeters />);

  expect(screen.getByTestId('quota-ai')).toHaveTextContent('—');
  expect(screen.getByTestId('quota-ai')).not.toHaveTextContent('15');
});

// ── disposition ────────────────────────────────────────────────────────────

it('lays the three meters out in a row by default', () => {
  useQuotas.mockReturnValue(state());
  const { container } = render(<QuotaMeters />);
  expect(container.querySelector('[data-layout="row"]')).toBeInTheDocument();
});

it('lays them out in a column when asked', () => {
  useQuotas.mockReturnValue(state());
  const { container } = render(<QuotaMeters layout="column" />);
  expect(container.querySelector('[data-layout="column"]')).toBeInTheDocument();
});
