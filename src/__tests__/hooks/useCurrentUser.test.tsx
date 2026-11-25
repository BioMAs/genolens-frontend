/**
 * The current user is read from `/users/me` through the shared profile query:
 * there is no browser-side session to listen to any more, the session lives in
 * httpOnly cookies the page cannot read.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import { useCurrentUser } from '@/hooks/useCurrentUser';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  mockedApi.get.mockReset();
});

describe('useCurrentUser', () => {
  it('derives the user from /users/me', async () => {
    mockedApi.get.mockResolvedValue({
      data: { id: 'u1', email: 'a@example.test', full_name: null },
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper(newClient()) });

    // Nobody until the profile has been read.
    expect(result.current).toEqual({ user: null, loading: true });

    await waitFor(() =>
      expect(result.current.user).toEqual({
        id: 'u1',
        email: 'a@example.test',
        name: 'a@example.test',
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(mockedApi.get).toHaveBeenCalledWith('/users/me');
  });

  it('prefers the full name over the e-mail', async () => {
    mockedApi.get.mockResolvedValue({
      data: { id: 'u1', email: 'a@example.test', full_name: 'Ada Example' },
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper(newClient()) });

    await waitFor(() => expect(result.current.user?.name).toBe('Ada Example'));
    expect(result.current.user).toEqual({
      id: 'u1',
      email: 'a@example.test',
      name: 'Ada Example',
    });
  });

  it('reads the profile already cached by the app instead of asking again', () => {
    const queryClient = newClient();
    queryClient.setQueryData(['userProfile'], {
      id: 'u1',
      email: 'a@example.test',
      full_name: 'Ada Example',
    });

    const { result } = renderHook(() => useCurrentUser(), { wrapper: makeWrapper(queryClient) });

    expect(result.current.user).toEqual({ id: 'u1', email: 'a@example.test', name: 'Ada Example' });
    expect(result.current.loading).toBe(false);
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('keeps the same user object between renders while the profile is unchanged', async () => {
    mockedApi.get.mockResolvedValue({ data: { id: 'u1', email: 'a@example.test' } });

    const { result, rerender } = renderHook(() => useCurrentUser(), {
      wrapper: makeWrapper(newClient()),
    });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    const first = result.current.user;
    rerender();

    // Consumers put it in effect dependencies: a fresh object per render would loop them.
    expect(result.current.user).toBe(first);
  });
});
