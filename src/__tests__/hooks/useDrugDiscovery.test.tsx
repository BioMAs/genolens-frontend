import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import { useDdTargetsWithRecovery } from '@/hooks/useDrugDiscovery';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const PARAMS = { indication: 'TCGA-BRCA', profile: 'default_oncology', allowExcluded: false };

function notFound() {
  return Object.assign(new Error('not found'), { response: { status: 404 } });
}

describe('useDdTargetsWithRecovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recrée le run une fois quand genolens-dd a oublié le run_id', async () => {
    // dd garde ses runs en mémoire : après un redémarrage, /targets rend 404.
    mockedApi.post.mockResolvedValueOnce({ data: { run_id: 'perdu' } })
                  .mockResolvedValueOnce({ data: { run_id: 'frais' } });
    mockedApi.get.mockRejectedValueOnce(notFound())
                 .mockResolvedValueOnce({ data: { run_id: 'frais', targets: [], n_ranked: 0 } });

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.data?.run_id).toBe('frais'));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });

  it("ne boucle pas quand le run frais rend 404 lui aussi", async () => {
    // Sans garde, un dd durablement cassé produirait une boucle de POST.
    mockedApi.post.mockResolvedValue({ data: { run_id: 'toujours-perdu' } });
    mockedApi.get.mockRejectedValue(notFound());

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });
});
