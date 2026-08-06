import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import { useUserProfile } from '@/hooks/useUserProfile';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useUserProfile', () => {
  it('rend le profil servi par /users/me', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'TEAM' },
    });
    const { result } = renderHook(() => useUserProfile(), { wrapper });
    await waitFor(() => expect(result.current.data?.subscription_plan).toBe('TEAM'));
    expect(mockedApi.get).toHaveBeenCalledWith('/users/me');
  });
});
