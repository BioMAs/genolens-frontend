/**
 * Le badge de crédits IA de la barre latérale et de la barre du haut.
 *
 * Il lisait `/users/me` lui-même, en `useEffect` sans cache — le troisième
 * appel non caché du même endpoint — et portait sa propre règle de calcul,
 * avec un quota gratuit de 15 codé en dur. Il lit désormais `useQuotas`.
 *
 * Le calcul est reporté à l'identique ; ce qui change est la source, et le
 * fait qu'un profil absent ne produise plus de chiffre.
 */
import { render, screen } from '@testing-library/react';

import QuotaDisplay from '@/components/QuotaDisplay';
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

it('shows the available credits', () => {
  useQuotas.mockReturnValue(state());
  render(<QuotaDisplay />);
  expect(screen.getByText('18 AI')).toBeInTheDocument();
});

it('shows zero when nothing is left', () => {
  useQuotas.mockReturnValue(state({ ai: { credits: 0, unlimited: false } }));
  render(<QuotaDisplay />);
  expect(screen.getByText('0 AI')).toBeInTheDocument();
});

it('shows unlimited on a plan without an AI cap', () => {
  useQuotas.mockReturnValue(state({ ai: { credits: null, unlimited: true } }));
  render(<QuotaDisplay />);
  expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
});

it('renders a placeholder while loading', () => {
  useQuotas.mockReturnValue(state({ isLoading: true, hasProfile: false }));
  const { container } = render(<QuotaDisplay />);

  expect(screen.queryByText(/AI/)).not.toBeInTheDocument();
  expect(container.firstChild).not.toBeNull();
});

it('renders nothing at all when the profile never arrived', () => {
  // Le cas qui compte. L'implémentation d'origine vérifiait la session
  // Supabase et rendait `null` sans elle. Sans cette garde, un 401 donne
  // crédits = max(0, 0 + 15) = 15 : le badge annoncerait « 15 AI » à un
  // utilisateur déconnecté, sur toutes les pages — la sidebar et la navbar le
  // rendent tous les deux.
  useQuotas.mockReturnValue(
    state({
      isLoading: false,
      hasProfile: false,
      isError: true,
      ai: { credits: 15, unlimited: false },
    })
  );
  const { container } = render(<QuotaDisplay />);

  expect(container).toBeEmptyDOMElement();
});

it('renders nothing when there is no profile and no error either', () => {
  // Utilisateur non authentifié : la requête n'a simplement rien rendu.
  useQuotas.mockReturnValue(
    state({ isLoading: false, hasProfile: false, isError: false, ai: { credits: 15, unlimited: false } })
  );
  const { container } = render(<QuotaDisplay />);

  expect(container).toBeEmptyDOMElement();
});

it('warns when credits run low', () => {
  useQuotas.mockReturnValue(state({ ai: { credits: 2, unlimited: false } }));
  render(<QuotaDisplay />);
  expect(screen.getByText('2 AI')).toBeInTheDocument();
});
