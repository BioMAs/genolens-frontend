import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';

import {
  useDdTargetsWithRecovery,
  useSignatureRun,
  useSignatureRunWithRecovery,
} from '@/hooks/useDrugDiscovery';

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

  it('expose `exhausted` quand la borne a servi et que dd oublie encore le run frais', async () => {
    // Avant l'ajout de ce champ, ce cas — la seconde tentative échouant aussi — ne se
    // distinguait en rien du premier 404 (silencieux, en cours de récupération) : rien dans le
    // hook ne permettait à la page de savoir que la borne était consommée pour de bon.
    let postCount = 0;
    mockedApi.post.mockImplementation(async () => ({
      data: { run_id: `run-${++postCount}` },
    }));
    mockedApi.get.mockRejectedValue(notFound());

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });

  it("`reset` réarme la borne et relance, permettant une nouvelle tentative", async () => {
    let postCount = 0;
    mockedApi.post.mockImplementation(async () => ({
      data: { run_id: `run-${++postCount}` },
    }));
    // Les deux premiers appels échouent (tentative initiale + récupération auto), le troisième
    // — déclenché par `reset()` — réussit : dd est redevenu disponible entre-temps.
    let getCount = 0;
    mockedApi.get.mockImplementation(async () => {
      getCount += 1;
      if (getCount <= 2) throw notFound();
      return { data: { run_id: `run-${postCount}`, targets: [], n_ranked: 0 } };
    });

    const { result } = renderHook(() => useDdTargetsWithRecovery(PARAMS, 50), { wrapper });

    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.data?.run_id).toBe('run-3'));
    expect(mockedApi.post).toHaveBeenCalledTimes(3);
    expect(result.current.exhausted).toBe(false);
  });
});

const SIGNATURE_PARAMS = {
  datasetId: 'd1',
  comparisonName: 'T_vs_C',
  indication: 'TCGA-BRCA',
  profile: 'default_oncology',
  allowExcluded: false,
  padjMax: 0.05,
  logfcMin: 1,
  directions: 'both' as const,
  maxGenesPerCondition: 1000,
  seed: 1234,
  replicates: { T: 4, C: 4 },
  allowUnderpowered: false,
};

describe('useSignatureRun', () => {
  beforeEach(() => jest.clearAllMocks());

  it("n'émet AUCUNE requête tant que les paramètres sont nuls", async () => {
    // Un run de signature écrit la liste de gènes de l'utilisateur dans un autre service : il ne
    // doit jamais partir de façon spéculative, contrairement au run de mode A qui ne lit que des
    // données publiques. `enabled` porte cette garantie, et c'est celle-ci qui est testée.
    const { result } = renderHook(() => useSignatureRun(null), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('traduit les paramètres vers le contrat du backend', async () => {
    mockedApi.post.mockResolvedValue({ data: { run_id: 'r1', result: {} } });
    const { result } = renderHook(() => useSignatureRun(SIGNATURE_PARAMS), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());

    const [, body] = mockedApi.post.mock.calls[0];
    expect(body).toMatchObject({
      dataset_id: 'd1',
      comparison_name: 'T_vs_C',
      indication: 'TCGA-BRCA',
      padj_max: 0.05,
      logfc_min: 1,
      max_genes_per_condition: 1000,
      replicates: { T: 4, C: 4 },
      seed: 1234,
    });
  });
});

describe('useSignatureRunWithRecovery', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejoue le run UNE SEULE FOIS sur un 404, puis expose `exhausted`', async () => {
    // Même borne que le mode A, mais l'enjeu est différent : ici réessayer RETRANSMET la liste
    // de gènes. La borne limite donc aussi le nombre de fois où les données de l'utilisateur
    // repartent sans qu'il le demande — pas seulement le risque de boucle de POST.
    mockedApi.post.mockRejectedValue(notFound());

    const { result } = renderHook(
      () => useSignatureRunWithRecovery(SIGNATURE_PARAMS),
      { wrapper },
    );

    await waitFor(() => expect(result.current.exhausted).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(2);
  });

  it('ne rejoue pas sur une erreur qui n’est pas un 404', async () => {
    // Un 422 est un rejet codé par règle : le rejouer à l'identique redonnerait le même rejet
    // et retransmettrait les gènes pour rien.
    mockedApi.post.mockRejectedValue(
      Object.assign(new Error('unprocessable'), {
        response: { status: 422, data: { detail: { rule_id: 'SIG002', conditions: ['T'] } } },
      }),
    );

    const { result } = renderHook(
      () => useSignatureRunWithRecovery(SIGNATURE_PARAMS),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockedApi.post).toHaveBeenCalledTimes(1);
    expect(result.current.exhausted).toBe(false);
  });
});
