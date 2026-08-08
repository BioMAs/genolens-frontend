import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import DrugDiscoveryComparisonPanel from '@/components/tools/dd/DrugDiscoveryComparisonPanel';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const STARTER_PROFILE = {
  data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'STARTER' },
};
const TEAM_PROFILE = {
  data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'TEAM' },
};

const CATALOGUE = {
  data: {
    indications: [
      { tcga_project: 'TCGA-BRCA', disease_name: 'Breast', excluded: false, rationale: null },
    ],
    profiles: ['default_oncology'],
  },
};

const STATUS = { data: { configured: true, reachable: true, ready: true } };

const PREVIEW = {
  data: {
    dataset_id: 'd1',
    comparison_name: 'T_vs_C',
    conditions: [
      {
        name: 'T',
        direction: 'UP',
        n_genes: 3,
        n_available: 3,
        truncated: false,
        replicates: 4,
        replicates_source: 'analysis_samplesheet',
      },
    ],
    needs_replicates: false,
    species: 'human',
    warnings: [],
  },
};

function route(url: string) {
  if (url.includes('/users/me') || url.includes('/user')) return Promise.resolve(TEAM_PROFILE);
  if (url.includes('/drug-discovery/status')) return Promise.resolve(STATUS);
  if (url.includes('/drug-discovery/indications')) return Promise.resolve(CATALOGUE);
  if (url.includes('/drug-discovery/signature-preview')) return Promise.resolve(PREVIEW);
  return Promise.resolve({ data: {} });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DrugDiscoveryComparisonPanel — garde de plan', () => {
  it("montre la carte d'upgrade à un STARTER et n'émet AUCUNE requête Drug Discovery", async () => {
    // Les requêtes DD partiraient au montage, donc avant que la garde n'ait pu rendre son
    // écran : sur un compte STARTER elles produiraient des 403 inutiles à chaque visite, et
    // l'écran d'upgrade s'afficherait par-dessus des erreurs réseau.
    mockedApi.get.mockImplementation((url: string) =>
      url.includes('/drug-discovery')
        ? Promise.reject(new Error('ne doit pas être appelé'))
        : Promise.resolve(STARTER_PROFILE),
    );

    render(
      <DrugDiscoveryComparisonPanel datasetId="d1" comparisonName="T_vs_C" />,
      { wrapper },
    );

    await waitFor(() =>
      expect(
        screen.getByText(/requires a TEAM or ON_PREMISE plan/),
      ).toBeInTheDocument(),
    );
    expect(
      mockedApi.get.mock.calls.filter(([url]) => String(url).includes('/drug-discovery')),
    ).toHaveLength(0);
  });
});

describe('DrugDiscoveryComparisonPanel — rien ne part sans clic', () => {
  it("n'émet aucun POST de signature avant que l'utilisateur ne lance le run", async () => {
    // Le mode A déclenche son calcul dès qu'une URL porte des paramètres, parce qu'il ne lit que
    // des données publiques. Ici un run envoie la liste de gènes de l'utilisateur à un autre
    // service : un calcul spéculatif serait une transmission qu'il n'a pas demandée.
    mockedApi.get.mockImplementation((url: string) => route(String(url)));

    render(
      <DrugDiscoveryComparisonPanel datasetId="d1" comparisonName="T_vs_C" />,
      { wrapper },
    );

    await waitFor(() =>
      expect(screen.getByText('Run against the ranking')).toBeInTheDocument(),
    );
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('garde le bouton désactivé tant qu’aucune indication n’est choisie', async () => {
    // Le mode B exige une indication : le tirage nul est apparié sur les déciles d'expression
    // tumorale, propres à un projet TCGA. Il n'y a pas d'équivalent pan-cancer.
    mockedApi.get.mockImplementation((url: string) => route(String(url)));

    render(
      <DrugDiscoveryComparisonPanel datasetId="d1" comparisonName="T_vs_C" />,
      { wrapper },
    );

    await waitFor(() =>
      expect(screen.getByText('Run against the ranking')).toBeInTheDocument(),
    );
    expect(screen.getByText('Run against the ranking')).toBeDisabled();
    expect(screen.getByText('Choose an indication first.')).toBeInTheDocument();
  });
});
