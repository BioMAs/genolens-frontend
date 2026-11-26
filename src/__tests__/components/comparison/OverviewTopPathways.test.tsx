/**
 * OverviewTopPathways : ce que la carte montre, quelle que soit la facon dont elle lit les voies.
 *
 * Ecrit AVANT de brancher la carte sur `useTopPathways` (elle faisait son propre `useEffect` +
 * `api.get`) : le test passait deja sur l'ancienne implementation, et il doit rester vert sur la
 * nouvelle — c'est ce qui prouve que le comportement visible n'a pas bouge.
 *
 * recharts est remplace par une liste : dans jsdom `ResponsiveContainer` n'a aucune taille et ne
 * dessinerait rien, donc on ne verrait ni l'ordre ni le nombre de barres.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import type { Dataset } from '@/types';
import OverviewTopPathways from '@/components/comparison/OverviewTopPathways';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: Array<{ id: string; name: string }> }) => (
    <ul data-testid="bars">
      {data.map((d) => (
        <li key={d.id || d.name}>{d.name}</li>
      ))}
    </ul>
  ),
  Bar: () => null,
  Cell: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

/* Le bouton d'export a besoin d'un ThemeProvider et du profil (compte demo) : sans rapport avec
   ce qui est verrouille ici. */
jest.mock('@/components/charts/ChartExportButton', () => ({
  __esModule: true,
  default: () => null,
}));

const ENRICHMENT = { id: 'enr-1' } as Dataset;

const row = (id: string, name: string, padj: number, extra: Record<string, unknown> = {}) => ({
  pathway_id: id,
  pathway_name: name,
  padj,
  gene_count: 12,
  ...extra,
});

function renderCard(props: Partial<React.ComponentProps<typeof OverviewTopPathways>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenEnrichment = jest.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <OverviewTopPathways
        enrichmentDataset={ENRICHMENT}
        comparisonName="Treated vs Control"
        onOpenEnrichment={onOpenEnrichment}
        {...props}
      />
    </QueryClientProvider>
  );
  return { onOpenEnrichment };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('OverviewTopPathways', () => {
  it("n'appelle rien et le dit quand aucun enrichissement n'est rattache", () => {
    renderCard({ enrichmentDataset: undefined });

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(
      screen.getByText('No enrichment results are attached to this comparison yet.')
    ).toBeInTheDocument();
  });

  it('lit les voies en cache de la comparaison, triees par padj', async () => {
    mockApi.get.mockResolvedValue({ data: { pathways: [row('GO:1', 'Alpha', 0.001)] } });
    renderCard();

    await waitFor(() => expect(screen.getByTestId('bars')).toBeInTheDocument());
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

  it('ne garde que les voies a padj <= 0,05 et au plus maxTerms, la plus forte en haut', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        pathways: [
          row('GO:1', 'Strongest', 1e-9),
          row('GO:2', 'Second', 1e-6),
          row('GO:3', 'Third', 0.01),
          row('GO:4', 'Too weak', 0.2),
          row('GO:5', 'Fourth', 0.04),
        ],
      },
    });
    renderCard({ maxTerms: 3 });

    await waitFor(() => expect(screen.getByTestId('bars')).toBeInTheDocument());
    // recharts dessine de haut en bas : la carte inverse la liste pour mettre la plus forte en haut.
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Third', 'Second', 'Strongest']);
  });

  it('retombe sur la description quand une voie n\'a pas de nom, et garde un padj nul', async () => {
    mockApi.get.mockResolvedValue({
      data: { pathways: [{ pathway_id: 'R:1', description: 'Described only', padj: 0 }] },
    });
    renderCard();

    await waitFor(() => expect(screen.getByText('Described only')).toBeInTheDocument());
  });

  it("offre d'ouvrir l'enrichissement quand des voies sont affichees", async () => {
    mockApi.get.mockResolvedValue({ data: { pathways: [row('GO:1', 'Alpha', 0.001)] } });
    const { onOpenEnrichment } = renderCard();

    await userEvent.click(await screen.findByRole('button', { name: 'All pathways →' }));
    expect(onOpenEnrichment).toHaveBeenCalledTimes(1);
  });

  it('annonce un echec de lecture plutot qu\'une carte vide muette', async () => {
    mockApi.get.mockRejectedValue(new Error('boom'));
    renderCard();

    expect(await screen.findByText('Enrichment results could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All pathways →' })).not.toBeInTheDocument();
  });

  it("le dit quand aucune voie n'atteint le seuil", async () => {
    mockApi.get.mockResolvedValue({ data: { pathways: [row('GO:4', 'Too weak', 0.2)] } });
    renderCard();

    expect(await screen.findByText('No pathway reaches adj. p ≤ 0.05.')).toBeInTheDocument();
  });

  it('affiche le squelette tant que la reponse n\'est pas arrivee', () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    renderCard();

    expect(screen.getByRole('figure')).toHaveAttribute('aria-busy', 'true');
  });
});
