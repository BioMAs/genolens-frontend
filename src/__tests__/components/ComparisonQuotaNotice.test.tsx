/**
 * Rappel de quota juste avant de lancer une analyse.
 *
 * C'est le seul endroit où le quota de comparaisons se dépense, et le seul
 * où il n'était pas dit : l'utilisateur lançait, puis découvrait le refus.
 */
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import ComparisonQuotaNotice, {
  useComparisonQuotaBlocked,
} from '@/components/analyses/ComparisonQuotaNotice';
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

// ── le rappel ──────────────────────────────────────────────────────────────

it('says how many comparisons are left before launching', () => {
  useQuotas.mockReturnValue(state());
  render(<ComparisonQuotaNotice />);

  expect(screen.getByText(/24/)).toBeInTheDocument();
  expect(screen.getByText(/comparisons? left/i)).toBeInTheDocument();
});

it('names the reset date', () => {
  useQuotas.mockReturnValue(state());
  render(<ComparisonQuotaNotice />);
  expect(screen.getByText(/october/i)).toBeInTheDocument();
});

it('warns and offers an upgrade when the quota is low', () => {
  useQuotas.mockReturnValue(
    state({ comparisons: { used: 28, max: 30, remaining: 2, unlimited: false }, tone: 'low' })
  );
  render(<ComparisonQuotaNotice />);

  expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/pricing');
});

it('says the quota is spent when nothing is left', () => {
  useQuotas.mockReturnValue(
    state({ comparisons: { used: 30, max: 30, remaining: 0, unlimited: false }, tone: 'exhausted' })
  );
  render(<ComparisonQuotaNotice />);

  expect(screen.getByText(/no comparison left/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /upgrade/i })).toBeInTheDocument();
});

it('renders nothing on an unlimited plan', () => {
  // Rien à rappeler : un bandeau « ∞ comparaisons restantes » serait du bruit
  // sur le seul écran où l'utilisateur veut avancer.
  useQuotas.mockReturnValue(
    state({ comparisons: { used: 120, max: null, remaining: null, unlimited: true } })
  );
  const { container } = render(<ComparisonQuotaNotice />);

  expect(container).toBeEmptyDOMElement();
});

it('renders nothing while the profile is unknown', () => {
  useQuotas.mockReturnValue(state({ isLoading: true, hasProfile: false }));
  const { container } = render(<ComparisonQuotaNotice />);
  expect(container).toBeEmptyDOMElement();
});

// ── la garde de soumission ────────────────────────────────────────────────

describe('useComparisonQuotaBlocked', () => {
  it('blocks when nothing is left', () => {
    useQuotas.mockReturnValue(
      state({ comparisons: { used: 30, max: 30, remaining: 0, unlimited: false } })
    );
    const { result } = renderHook(() => useComparisonQuotaBlocked());
    expect(result.current).toBe(true);
  });

  it('does not block while comparisons remain', () => {
    useQuotas.mockReturnValue(state());
    const { result } = renderHook(() => useComparisonQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block an unlimited plan', () => {
    useQuotas.mockReturnValue(
      state({ comparisons: { used: 120, max: null, remaining: null, unlimited: true } })
    );
    const { result } = renderHook(() => useComparisonQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block while the profile is in flight', () => {
    // Bloquer par défaut empêcherait un lancement légitime chaque fois que la
    // requête est lente.
    useQuotas.mockReturnValue(
      state({
        isLoading: true,
        hasProfile: false,
        comparisons: { used: 0, max: 0, remaining: 0, unlimited: false },
      })
    );
    const { result } = renderHook(() => useComparisonQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block when the profile never arrived', () => {
    useQuotas.mockReturnValue(
      state({
        isLoading: false,
        hasProfile: false,
        isError: true,
        comparisons: { used: 0, max: 0, remaining: 0, unlimited: false },
      })
    );
    const { result } = renderHook(() => useComparisonQuotaBlocked());
    expect(result.current).toBe(false);
  });
});
