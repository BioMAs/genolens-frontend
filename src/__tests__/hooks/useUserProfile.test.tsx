import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import { invalidateUserProfile, useUserProfile } from '@/hooks/useUserProfile';
import { useDrugDiscoveryModule, useScientificModule } from '@/hooks/useAddOnModules';

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

  it("partage sa requête avec les modules add-on, qui lisaient l'ancienne clé ['user','me']", async () => {
    mockedApi.get.mockClear();
    mockedApi.get.mockResolvedValue({
      data: { id: 'u1', role: 'USER', subscription_plan: 'TEAM', has_scientific_module: true },
    });
    const { result } = renderHook(
      () => ({
        profile: useUserProfile(),
        scientific: useScientificModule(),
        drugDiscovery: useDrugDiscoveryModule(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.scientific.loaded).toBe(true));
    expect(result.current.scientific.unlocked).toBe(true);
    expect(result.current.drugDiscovery.unlocked).toBe(false);
    expect(mockedApi.get).toHaveBeenCalledTimes(1);
  });

  it("n'interroge pas /users/me tant que enabled vaut false (page publique, visiteur anonyme)", async () => {
    mockedApi.get.mockClear();
    const { result } = renderHook(() => useUserProfile({ enabled: false }), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(mockedApi.get).not.toHaveBeenCalled();
  });

  it('invalidateUserProfile fait relire le profil', async () => {
    mockedApi.get.mockClear();
    mockedApi.get
      .mockResolvedValueOnce({ data: { id: 'u1', ai_requests_used: 3 } })
      .mockResolvedValueOnce({ data: { id: 'u1', ai_requests_used: 4 } });
    const { result } = renderHook(
      () => ({ profile: useUserProfile(), queryClient: useQueryClient() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.profile.data?.ai_requests_used).toBe(3));

    act(() => invalidateUserProfile(result.current.queryClient));

    await waitFor(() => expect(result.current.profile.data?.ai_requests_used).toBe(4));
    expect(mockedApi.get).toHaveBeenCalledTimes(2);
  });
});
