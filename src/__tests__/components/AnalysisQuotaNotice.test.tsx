/**
 * Rappel de quota juste avant de lancer une analyse.
 *
 * C'est le seul endroit où le quota se dépense, et le seul où il n'était pas
 * dit : l'utilisateur lançait, puis découvrait le refus.
 *
 * **Une analyse coûte une unité**, quel que soit son nombre de contrastes.
 * Une version précédente de ce rappel comparait les contrastes déclarés au
 * reste du mois et bloquait au-delà — elle répliquait une garde backend qui
 * comptait la mauvaise unité. Les tests de ce comptage sont remplacés par leur
 * inverse, `ne bloque pas une analyse à 12 contrastes avec une seule unité`.
 */
import { render, screen } from '@testing-library/react';
import { renderHook } from '@testing-library/react';

import AnalysisQuotaNotice, {
  useAnalysisQuotaBlocked,
} from '@/components/analyses/AnalysisQuotaNotice';
import type { QuotaState } from '@/hooks/useQuotas';

jest.mock('@/hooks/useQuotas', () => ({
  ...jest.requireActual('@/hooks/useQuotas'),
  useQuotas: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useQuotas } = require('@/hooks/useQuotas');

function state(overrides: Partial<QuotaState> = {}): QuotaState {
  return {
    analyses: { used: 6, max: 30, remaining: 24, unlimited: false },
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

it('says how many analyses are left before launching', () => {
  useQuotas.mockReturnValue(state());
  render(<AnalysisQuotaNotice />);

  expect(screen.getByText(/24/)).toBeInTheDocument();
  expect(screen.getByText(/analyses? left/i)).toBeInTheDocument();
});

it('names the reset date', () => {
  useQuotas.mockReturnValue(state());
  render(<AnalysisQuotaNotice />);
  expect(screen.getByText(/october/i)).toBeInTheDocument();
});

it('warns and offers an upgrade when the quota is low', () => {
  useQuotas.mockReturnValue(
    state({ analyses: { used: 28, max: 30, remaining: 2, unlimited: false }, tone: 'low' })
  );
  render(<AnalysisQuotaNotice />);

  expect(screen.getByRole('link', { name: /upgrade/i })).toHaveAttribute('href', '/pricing');
});

it('says the quota is spent when nothing is left', () => {
  useQuotas.mockReturnValue(
    state({ analyses: { used: 30, max: 30, remaining: 0, unlimited: false }, tone: 'exhausted' })
  );
  render(<AnalysisQuotaNotice />);

  expect(screen.getByText(/no analysis left/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /upgrade/i })).toBeInTheDocument();
});

it('renders nothing on an unlimited plan', () => {
  // Rien à rappeler : un bandeau « ∞ comparaisons restantes » serait du bruit
  // sur le seul écran où l'utilisateur veut avancer.
  useQuotas.mockReturnValue(
    state({ analyses: { used: 120, max: null, remaining: null, unlimited: true } })
  );
  const { container } = render(<AnalysisQuotaNotice />);

  expect(container).toBeEmptyDOMElement();
});

it('renders nothing while the profile is unknown', () => {
  useQuotas.mockReturnValue(state({ isLoading: true, hasProfile: false }));
  const { container } = render(<AnalysisQuotaNotice />);
  expect(container).toBeEmptyDOMElement();
});

// ── la garde de soumission ────────────────────────────────────────────────

describe('useAnalysisQuotaBlocked', () => {
  it('blocks when nothing is left', () => {
    useQuotas.mockReturnValue(
      state({ analyses: { used: 30, max: 30, remaining: 0, unlimited: false } })
    );
    const { result } = renderHook(() => useAnalysisQuotaBlocked());
    expect(result.current).toBe(true);
  });

  it('does not block while comparisons remain', () => {
    useQuotas.mockReturnValue(state());
    const { result } = renderHook(() => useAnalysisQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block an unlimited plan', () => {
    useQuotas.mockReturnValue(
      state({ analyses: { used: 120, max: null, remaining: null, unlimited: true } })
    );
    const { result } = renderHook(() => useAnalysisQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block while the profile is in flight', () => {
    // Bloquer par défaut empêcherait un lancement légitime chaque fois que la
    // requête est lente.
    useQuotas.mockReturnValue(
      state({
        isLoading: true,
        hasProfile: false,
        analyses: { used: 0, max: 0, remaining: 0, unlimited: false },
      })
    );
    const { result } = renderHook(() => useAnalysisQuotaBlocked());
    expect(result.current).toBe(false);
  });

  it('does not block when the profile never arrived', () => {
    useQuotas.mockReturnValue(
      state({
        isLoading: false,
        hasProfile: false,
        isError: true,
        analyses: { used: 0, max: 0, remaining: 0, unlimited: false },
      })
    );
    const { result } = renderHook(() => useAnalysisQuotaBlocked());
    expect(result.current).toBe(false);
  });
});

// ── le nombre de contrastes n'entre pas dans le quota ─────────────────────

it('counts a run as one, whatever its number of contrasts', () => {
  useQuotas.mockReturnValue(state());
  render(<AnalysisQuotaNotice />);
  expect(screen.getByText(/counts as one/i)).toBeInTheDocument();
});

it('does not block a run when a single unit remains', () => {
  // L'inverse exact de l'ancien comportement : un fichier a 12 contrastes
  // lance avec une seule unite restante passait pour un depassement.
  useQuotas.mockReturnValue(
    state({ analyses: { used: 29, max: 30, remaining: 1, unlimited: false } })
  );
  const { result } = renderHook(() => useAnalysisQuotaBlocked());
  expect(result.current).toBe(false);
});
