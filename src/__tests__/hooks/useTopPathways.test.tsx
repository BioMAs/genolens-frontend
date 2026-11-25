/**
 * Les voies qui répondent à « qu'est-ce que ça fait ? ».
 *
 * Le hook reprend à l'identique la lecture que `OverviewTopPathways` faisait en direct (mêmes
 * paramètres, même filtre `padj <= 0,05`, mêmes champs) et y ajoute le sens de la voie.
 *
 * Un test pèse plus que les autres : celui qui monte ce hook À CÔTÉ de `useGeneToPathways`.
 * Les deux lisent le même endpoint, et le plan nommait pour celui-ci la clé
 * `['enrichment-pathways', id, comparaison]` — déjà prise par l'autre, avec une autre forme de
 * donnée. Sur une même clé, le second lecteur reçoit sans refetch la forme du premier, et
 * TypeScript ne voit rien : la clé n'est typée par personne.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useTopPathways } from '@/hooks/useTopPathways';
import { useGeneToPathways } from '@/hooks/useGeneToPathways';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const row = (id: string, name: string, padj: number, extra: Record<string, unknown> = {}) => ({
  pathway_id: id,
  pathway_name: name,
  padj,
  gene_count: 12,
  genes: ['IL6', 'PTGS2'],
  ...extra,
});

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, queryClient };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('sans enrichissement rattaché', () => {
  it("n'appelle rien et rend null, sans chargement ni erreur", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways(undefined, 'T_vs_C'), { wrapper });

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current.pathways).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});

describe('avec un enrichissement', () => {
  it('lit les voies en cache de la comparaison, avec les paramètres historiques de la carte', async () => {
    mockApi.get.mockResolvedValue({ data: { pathways: [row('GO:1', 'Alpha', 0.001)] } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'Treated vs Control'), { wrapper });

    await waitFor(() => expect(result.current.pathways).not.toBeNull());
    expect(mockApi.get).toHaveBeenCalledTimes(1);
    expect(mockApi.get).toHaveBeenCalledWith(
      '/datasets/enr-1/enrichment-pathways/Treated%20vs%20Control',
      {
        params: {
          regulation: 'ALL',
          page: 1,
          page_size: 100,
          padj_max: 0.05,
          sort_by: 'padj',
          sort_order: 'asc',
        },
      }
    );
  });

  it('rend isLoading puis les voies, avec les champs de la carte', async () => {
    mockApi.get.mockResolvedValue({
      data: { pathways: [row('GO:1', 'Alpha', 0.001, { category: 'GO:BP' })] },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C'), { wrapper });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.pathways).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pathways).toEqual([
      { id: 'GO:1', name: 'Alpha', padj: 0.001, geneCount: 12, category: 'GO:BP', direction: null },
    ]);
  });

  it('écarte ce qui dépasse padj 0,05 et ne garde que n voies (7 par défaut)', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        pathways: [
          row('GO:1', 'One', 1e-9),
          row('GO:2', 'Two', 1e-6),
          row('GO:3', 'Three', 0.01),
          row('GO:4', 'Too weak', 0.2),
          row('GO:5', 'Four', 0.04),
        ],
      },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C', 3), { wrapper });

    await waitFor(() => expect(result.current.pathways).not.toBeNull());
    expect(result.current.pathways!.map((p) => p.name)).toEqual(['One', 'Two', 'Three']);

    const many = Array.from({ length: 12 }, (_, i) => row(`GO:${i}`, `P${i}`, 1e-6 * (i + 1)));
    mockApi.get.mockResolvedValue({ data: { pathways: many } });
    const { wrapper: wrapper2 } = makeWrapper();
    const defaults = renderHook(() => useTopPathways('enr-2', 'T_vs_C'), { wrapper: wrapper2 });
    await waitFor(() => expect(defaults.result.current.pathways).not.toBeNull());
    expect(defaults.result.current.pathways).toHaveLength(7);
  });

  it('change de n sans nouvelle requête', async () => {
    mockApi.get.mockResolvedValue({
      data: { pathways: [row('GO:1', 'One', 1e-9), row('GO:2', 'Two', 1e-6), row('GO:3', 'Three', 0.01)] },
    });
    const { wrapper } = makeWrapper();
    const { result, rerender } = renderHook(({ n }) => useTopPathways('enr-1', 'T_vs_C', n), {
      wrapper,
      initialProps: { n: 1 },
    });

    await waitFor(() => expect(result.current.pathways).toHaveLength(1));
    rerender({ n: 3 });
    expect(result.current.pathways).toHaveLength(3);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('garde un padj nul et retombe sur la description quand le nom manque', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        pathways: [
          { pathway_id: 'R:1', description: 'Described only', padj: 0 },
          { pathway_id: 'R:2', padj: 0.01 },
        ],
      },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C'), { wrapper });

    await waitFor(() => expect(result.current.pathways).not.toBeNull());
    expect(result.current.pathways!.map((p) => [p.name, p.padj, p.geneCount])).toEqual([
      ['Described only', 0, 0],
      ['—', 0.01, 0],
    ]);
  });

  it('rend [] et non null quand aucune voie ne passe le seuil', async () => {
    mockApi.get.mockResolvedValue({ data: { pathways: [row('GO:4', 'Too weak', 0.2)] } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.pathways).toEqual([]);
  });

  it("signale l'échec par isError, pathways restant null", async () => {
    mockApi.get.mockRejectedValue(new Error('boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.pathways).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('sens de la voie', () => {
  it.each([
    ['UP', 'up'],
    ['up', 'up'],
    ['DOWN', 'down'],
    ['down', 'down'],
    ['ALL', null],
    ['', null],
    [undefined, null],
  ])('regulation %p -> direction %p', async (regulation, direction) => {
    mockApi.get.mockResolvedValue({
      data: { pathways: [row('GO:1', 'Alpha', 0.001, { regulation })] },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopPathways('enr-1', 'T_vs_C'), { wrapper });

    await waitFor(() => expect(result.current.pathways).not.toBeNull());
    expect(result.current.pathways![0].direction).toBe(direction);
  });
});

describe('cohabitation avec useGeneToPathways', () => {
  it("ne lit pas la donnée de l'autre, dans un sens comme dans l'autre", async () => {
    // Le serveur répond selon les paramètres, comme le vrai : une page de 1000 pour la carte du
    // gène, les voies significatives pour la carte des voies.
    mockApi.get.mockImplementation(async (_url: string, config?: { params?: { page_size?: number } }) => ({
      data: {
        pathways:
          config?.params?.page_size === 1000
            ? [row('GO:1', 'Alpha', 0.001), row('GO:9', 'Weak', 0.9)]
            : [row('GO:1', 'Alpha', 0.001)],
      },
    }));

    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        gene: useGeneToPathways({ enrichmentDatasetId: 'enr-1', comparisonName: 'T_vs_C', enabled: true }),
        top: useTopPathways('enr-1', 'T_vs_C'),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.top.pathways).not.toBeNull());
    await waitFor(() => expect(result.current.gene.isSuccess).toBe(true));

    // Chacun a sa forme : brute (avec `genes`) d'un côté, analysée de l'autre.
    expect(result.current.top.pathways).toEqual([
      { id: 'GO:1', name: 'Alpha', padj: 0.001, geneCount: 12, direction: null },
    ]);
    expect(result.current.gene.data).toHaveLength(2);
    expect(result.current.gene.index.get('IL6')?.map((p) => p.id)).toEqual(['GO:1', 'GO:9']);
  });
});
