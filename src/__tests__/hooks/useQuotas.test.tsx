/**
 * `useQuotas` est la seule autorité sur « ce qu'il me reste ».
 *
 * Il existe pour que les composants ne portent aucune règle : avant lui, la
 * règle des crédits IA (avec son quota gratuit de 15 codé en dur) vivait dans
 * QuotaDisplay, la limite de projets était lue sur une charge utile qui ne la
 * contient pas, et huit lecteurs appelaient /users/me sous quatre identités de
 * cache.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import { nextMonthlyReset, quotaTone, useQuotas } from '@/hooks/useQuotas';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '@/utils/api';

const mockApi = api as jest.Mocked<typeof api>;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

const PROFILE = {
  id: 'u1',
  email: 'a@b.c',
  role: 'USER',
  subscription_plan: 'STARTER',
  ai_interpretations_used: 4,
  ai_tokens_purchased: 10,
  ai_tokens_used: 3,
  comparisons_used_this_month: 6,
  comparisons_quota: 30,
  comparisons_remaining: 24,
  max_projects: 15,
  max_datasets_per_project: 5,
  project_count: 4,
};

function mockEndpoints(profile: Record<string, unknown>) {
  // Un seul endpoint : `useQuotas` ne lit que /users/me. Tout autre appel est
  // un rejet volontaire — si le hook se remet à interroger /projects, le test
  // le signale au lieu de le tolérer.
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve({ data: profile } as never);
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── quotaTone (pure) ───────────────────────────────────────────────────────

describe('quotaTone', () => {
  it('is ok above 20% remaining', () => {
    expect(quotaTone(24, 30)).toBe('ok');
    expect(quotaTone(7, 30)).toBe('ok'); // 23.3%
  });

  it('is low at exactly 20% remaining', () => {
    expect(quotaTone(6, 30)).toBe('low');
  });

  it('is low below 20% remaining', () => {
    expect(quotaTone(1, 30)).toBe('low');
  });

  it('is exhausted at zero', () => {
    expect(quotaTone(0, 30)).toBe('exhausted');
  });

  it('is ok when unlimited', () => {
    expect(quotaTone(null, null)).toBe('ok');
  });
});

// ── nextMonthlyReset (pure) ────────────────────────────────────────────────

describe('nextMonthlyReset', () => {
  it('is the first of next month', () => {
    // Le worker remet le compteur à zéro le 1er (worker/tasks/quota_tasks.py).
    const reset = nextMonthlyReset(new Date('2026-09-07T12:00:00Z'));
    expect(reset.getFullYear()).toBe(2026);
    expect(reset.getMonth()).toBe(9); // octobre, 0-indexé
    expect(reset.getDate()).toBe(1);
  });

  it('rolls over the year in December', () => {
    const reset = nextMonthlyReset(new Date('2026-12-20T12:00:00Z'));
    expect(reset.getFullYear()).toBe(2027);
    expect(reset.getMonth()).toBe(0);
    expect(reset.getDate()).toBe(1);
  });
});

// ── useQuotas ──────────────────────────────────────────────────────────────

describe('useQuotas', () => {
  it('maps the comparison quota from /users/me', async () => {
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comparisons).toEqual({
      used: 6,
      max: 30,
      remaining: 24,
      unlimited: false,
    });
    expect(result.current.tone).toBe('ok');
  });

  it('reads /users/me exactly once', async () => {
    // `useCosmetics.ts` exporte un SECOND `useUserProfile`, sur la clé
    // ['user','me'], que `useAddOnModules` importe. Les deux renvoient
    // `UseQueryResult<UserProfile>` : importer le mauvais coûterait une
    // requête de plus sans la moindre erreur de type. Cette assertion est le
    // seul garde-fou contre cette confusion.
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith('/users/me');
  });

  it('takes the owned project count from /users/me, not from the projects list', async () => {
    // Deux pièges à la fois : GET /billing/subscription ne renvoie ni
    // project_count ni max_projects (les lire là donnait toujours 0), et
    // GET /projects renvoie « possédés ou partagés », donc son `total`
    // compterait les projets partagés contre le quota de l'utilisateur.
    // La seule source correcte est `project_count` de /users/me, qui applique
    // le même prédicat que la limite du backend.
    mockEndpoints({ ...PROFILE, project_count: 9 });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.projects).toEqual({
      used: 9,
      max: 15,
      remaining: 6,
      unlimited: false,
    });
  });

  it('computes AI credits as paid remainder plus free allowance', async () => {
    // (10 - 3) + max(0, 15 - 4) = 18
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.ai).toEqual({ credits: 18, unlimited: false });
  });

  it('never reports negative AI credits when paid tokens are overdrawn', async () => {
    // Report exact du calcul de QuotaDisplay : (2 - 9) + max(0, 15 - 15) = -7,
    // ramené à 0. Un badge « −7 AI » n'aurait aucun sens.
    mockEndpoints({
      ...PROFILE,
      ai_tokens_purchased: 2,
      ai_tokens_used: 9,
      ai_interpretations_used: 15,
    });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.ai).toEqual({ credits: 0, unlimited: false });
  });

  it('reports AI as unlimited on a TEAM plan', async () => {
    mockEndpoints({ ...PROFILE, subscription_plan: 'TEAM' });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.ai).toEqual({ credits: null, unlimited: true });
  });

  it('reports everything unlimited for an admin role', async () => {
    mockEndpoints({
      ...PROFILE,
      role: 'ADMIN',
      comparisons_quota: null,
      comparisons_remaining: null,
      max_projects: null,
    });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comparisons.unlimited).toBe(true);
    expect(result.current.projects.unlimited).toBe(true);
    expect(result.current.ai.unlimited).toBe(true);
    expect(result.current.tone).toBe('ok');
  });

  it('reports exhausted when no comparison remains', async () => {
    mockEndpoints({
      ...PROFILE,
      comparisons_used_this_month: 30,
      comparisons_remaining: 0,
    });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tone).toBe('exhausted');
  });

  it('fails closed on a profile missing its quota fields', async () => {
    // Un champ absent ne doit pas être lu comme « illimité » : c'est ainsi
    // qu'un plan plafonné a pu afficher ∞.
    mockEndpoints({
      id: 'u1',
      email: 'a@b.c',
      role: 'USER',
      subscription_plan: 'STARTER',
      ai_interpretations_used: 0,
      ai_tokens_purchased: 0,
      ai_tokens_used: 0,
    });
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comparisons.unlimited).toBe(false);
    expect(result.current.comparisons.max).toBe(0);
    expect(result.current.tone).toBe('exhausted');
  });

  // ── état de chargement et d'erreur ───────────────────────────────────────

  it('stays neutral while loading instead of looking exhausted', async () => {
    // Sans ça, pendant le vol de /users/me : max 0 et remaining 0 donnent le
    // ton « exhausted », donc un placeholder rouge et un CTA « Upgrade » sur
    // chaque chargement du dashboard. Et `isAtProjectLimit` verrait 0 >= 0,
    // désactivant « New project » avec « Project limit reached (0/0) ».
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.tone).toBe('ok');
    expect(result.current.hasProfile).toBe(false);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('reports no profile when the request fails, rather than a free allowance', async () => {
    // Sur un 401, un profil absent donnait crédits = max(0, 0 + 15) = 15 :
    // le badge annonçait « 15 AI » à un utilisateur déconnecté, sur toutes
    // les pages. `hasProfile` laisse au composant le moyen de ne rien rendre.
    mockApi.get.mockRejectedValue(new Error('401'));
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    // `useUserProfile` impose `retry: 1`, que le `retry: false` du wrapper ne
    // peut pas contredire : il faut laisser passer la temporisation du réessai
    // (~1 s), au-delà du délai par défaut de waitFor.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(result.current.hasProfile).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it('reports a profile once it has arrived', async () => {
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasProfile).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it('resets on the first of next month', async () => {
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.resetsOn.getDate()).toBe(1);
    expect(result.current.resetsOn.getTime()).toBeGreaterThan(Date.now());
  });

  it('exposes the per-project dataset limit from the profile', async () => {
    mockEndpoints(PROFILE);
    const { result } = renderHook(() => useQuotas(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.maxDatasetsPerProject).toBe(5);
  });
});
