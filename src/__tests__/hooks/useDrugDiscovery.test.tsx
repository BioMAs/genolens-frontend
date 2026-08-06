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
    // Réaliste : côté genolens-dd, POST /runs fait run_id = str(uuid.uuid4()), donc CHAQUE
    // appel mint un identifiant frais, même à paramètres identiques. Un mock qui renvoie un
    // run_id répété masquerait un défaut de la borne de récupération (voir critique de revue).
    let postCount = 0;
    mockedApi.post.mockImplementation(async () => ({
      data: { run_id: `run-${++postCount}` },
    }));
    // dd garde ses runs en mémoire : après un redémarrage, /targets rend 404 pour le premier run.
    let getCount = 0;
    mockedApi.get.mockImplementation(async () => {
      getCount += 1;
      if (getCount === 1) throw notFound();
      return { data: { run_id: `run-${postCount}`, targets: [], n_ranked: 0 } };
    });

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.data?.run_id).toBe('run-2'));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });

  it('ne boucle pas quand le run frais rend 404 lui aussi', async () => {
    // Toujours un run_id frais par POST (comme le vrai service), et /targets rend 404 pour
    // TOUS les runs : sans garde, ceci produirait une boucle de POST sans fin.
    let postCount = 0;
    mockedApi.post.mockImplementation(async () => ({
      data: { run_id: `run-${++postCount}` },
    }));
    mockedApi.get.mockRejectedValue(notFound());

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });
});
