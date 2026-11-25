/**
 * The pricing page reads the profile through the shared `useUserProfile` query.
 *
 * It used to call `/users/me` by hand in a useEffect: a visitor coming from the
 * app refetched a profile already in cache. It must still never ask for it
 * without a session — the page is public and an anonymous visitor would get a
 * 401. A session is told by the readable `gl_session=1` cookie the API sets
 * alongside its httpOnly ones; the real `hasSessionHint` runs here.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

jest.mock('@/hooks/usePricing', () => ({
  usePricing: () => ({ data: undefined, isLoading: false, isError: false }),
}));

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/utils/api';
import PricingPage from '@/app/pricing/page';

const mockedApi = api as jest.Mocked<typeof api>;

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <PricingPage />
    </QueryClientProvider>,
  );
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function setSessionHint() {
  document.cookie = 'gl_session=1; path=/';
}

describe('PricingPage profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    document.cookie = 'gl_session=; path=/; max-age=0';
    document.cookie = 'not_gl_session=; path=/; max-age=0';
  });

  it('never calls /users/me for an anonymous visitor', async () => {
    renderPage(newClient());

    await new Promise((r) => setTimeout(r, 20));
    expect(mockedApi.get).not.toHaveBeenCalledWith('/users/me');
  });

  it('reads the profile through the shared query once a session hint exists', async () => {
    setSessionHint();
    mockedApi.get.mockResolvedValue({ data: { id: 'u1', subscription_plan: 'TEAM' } });
    const queryClient = newClient();

    renderPage(queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryData(['userProfile'])).toEqual({
        id: 'u1',
        subscription_plan: 'TEAM',
      }),
    );
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
    expect(mockedApi.get).toHaveBeenCalledWith('/users/me');
  });

  it('reuses a profile already cached by the app instead of refetching it', async () => {
    setSessionHint();
    const queryClient = newClient();
    queryClient.setQueryData(['userProfile'], { id: 'u1', subscription_plan: 'STARTER' });

    renderPage(queryClient);

    await new Promise((r) => setTimeout(r, 20));
    expect(mockedApi.get).not.toHaveBeenCalledWith('/users/me');
  });

  it('does not take a look-alike cookie for a session', async () => {
    document.cookie = 'not_gl_session=1; path=/';

    renderPage(newClient());

    await new Promise((r) => setTimeout(r, 20));
    expect(mockedApi.get).not.toHaveBeenCalledWith('/users/me');
  });
});
