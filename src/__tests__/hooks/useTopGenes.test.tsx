/**
 * Les gènes qui répondent à « qu'est-ce qui a bougé ? ».
 *
 * Ce hook ne fait que trier le nuage du volcano déjà en cache : il n'a pas de requête à lui. Les
 * tests portent donc sur la sélection — qui entre, dans quel ordre, et que faire de ce qui n'est
 * pas un gène — et sur le fait de suivre les seuils de la page plutôt que ceux de l'ingestion.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useTopGenes } from '@/hooks/useTopGenes';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
} from '@/contexts/ComparisonSelectionContext';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const point = (gene: string, x: number, padj: number) => ({
  gene,
  x,
  y: -Math.log10(padj),
  padj,
  // Le verdict du serveur est celui des seuils de la requête : il doit être ignoré.
  is_significant: true,
});

/**
 * Aux seuils par défaut (padj < 0,05, |log2FC| > 0,58) :
 * - up   : IL6 et PTGS2 à padj égal (IL6 gagne au |x|), puis CXCL8, puis WEAK_BIGFC (padj le
 *          plus faible, donc dernier malgré le plus gros |x|)
 * - down : COL1A1 et MMP1 à padj égal (MMP1 gagne au |x|) — COL1A1 est volontairement AVANT
 *          MMP1 dans le nuage, pour qu'un tri qui garderait l'ordre du nuage échoue
 */
const CLOUD = [
  point('COL1A1', -1.2, 1e-6),
  point('PTGS2', 2.0, 1e-8),
  point('WEAK_BIGFC', 6.0, 0.04),
  point('IL6', 3.1, 1e-8),
  point('CXCL8', 1.5, 1e-4),
  point('MMP1', -2.5, 1e-6),
  // Ce qui ne doit jamais sortir, quel que soit son padj :
  point('Unknown', 5.0, 1e-20), // sentinelle du backend, pas un gène
  point('', 4.0, 1e-30),
  point('NS_BY_PADJ', 4.0, 0.2),
  point('NS_BY_LFC', 0.1, 1e-9),
];

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ComparisonSelectionProvider>{children}</ComparisonSelectionProvider>
    </QueryClientProvider>
  );
  return { wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockResolvedValue({
    data: {
      dataset_id: 'ds-1',
      comparison_name: 'T_vs_C',
      points: CLOUD,
      total_genes: CLOUD.length,
      significant_genes: 99,
      cached: true,
    },
  });
});

describe('useTopGenes', () => {
  it('trie par padj croissant puis |log2FC| décroissant', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C', 10), { wrapper });

    await waitFor(() => expect(result.current.up.length).toBeGreaterThan(0));
    expect(result.current.up.map((p) => p.gene)).toEqual(['IL6', 'PTGS2', 'CXCL8', 'WEAK_BIGFC']);
    expect(result.current.down.map((p) => p.gene)).toEqual(['MMP1', 'COL1A1']);
  });

  it('sépare surexprimés et sous-exprimés par le signe du log2FC', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C', 10), { wrapper });

    await waitFor(() => expect(result.current.up.length).toBeGreaterThan(0));
    expect(result.current.up.every((p) => p.x > 0)).toBe(true);
    expect(result.current.down.every((p) => p.x < 0)).toBe(true);
  });

  it("ne garde que n gènes par côté (8 par défaut)", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C', 2), { wrapper });

    await waitFor(() => expect(result.current.up.length).toBeGreaterThan(0));
    expect(result.current.up.map((p) => p.gene)).toEqual(['IL6', 'PTGS2']);
    expect(result.current.down.map((p) => p.gene)).toEqual(['MMP1', 'COL1A1']);

    const many = Array.from({ length: 20 }, (_, i) => point(`G${i}`, 2 + i / 100, 1e-5 * (i + 1)));
    mockApi.get.mockResolvedValue({ data: { points: many, total_genes: 20, significant_genes: 20 } });
    const { wrapper: wrapper2 } = makeWrapper();
    const defaults = renderHook(() => useTopGenes('ds-2', 'T_vs_C'), { wrapper: wrapper2 });
    await waitFor(() => expect(defaults.result.current.up.length).toBeGreaterThan(0));
    expect(defaults.result.current.up).toHaveLength(8);
  });

  it("écarte la sentinelle Unknown et les points sans nom, même très significatifs", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C', 20), { wrapper });

    await waitFor(() => expect(result.current.up.length).toBeGreaterThan(0));
    const all = [...result.current.up, ...result.current.down].map((p) => p.gene);
    expect(all).not.toContain('Unknown');
    expect(all).not.toContain('');
  });

  it("ignore le verdict du serveur : un point non significatif aux seuils n'entre pas", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C', 20), { wrapper });

    await waitFor(() => expect(result.current.up.length).toBeGreaterThan(0));
    const all = [...result.current.up, ...result.current.down].map((p) => p.gene);
    expect(all).not.toContain('NS_BY_PADJ');
    expect(all).not.toContain('NS_BY_LFC');
  });

  it('suit les seuils de la page sans nouvelle requête', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({ top: useTopGenes('ds-1', 'T_vs_C', 10), actions: useComparisonActions() }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.top.up).toHaveLength(4));
    act(() => result.current.actions.setThresholds({ logfc: 2.2 }));

    // PTGS2 (2,0) et CXCL8 (1,5) passent sous le seuil ; WEAK_BIGFC (6,0) reste.
    expect(result.current.top.up.map((p) => p.gene)).toEqual(['IL6', 'WEAK_BIGFC']);
    expect(result.current.top.down.map((p) => p.gene)).toEqual(['MMP1']);
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  it('rend deux listes vides et isLoading tant que le nuage est en route', async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', 'T_vs_C'), { wrapper });

    expect(result.current).toMatchObject({ up: [], down: [], isLoading: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("n'appelle rien sans comparaison", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTopGenes('ds-1', ''), { wrapper });

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ up: [], down: [], isLoading: false });
  });
});
