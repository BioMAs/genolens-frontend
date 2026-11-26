/**
 * Après une génération réussie, la lecture IA que la page de lecture affiche en réponse 4 doit se
 * mettre à jour : `AIInterpretationPanel` invalide l'entrée de `useSavedInterpretation`.
 *
 * Sans cela, la réponse 4 resterait sur « Not written yet » jusqu'à l'expiration de l'entrée
 * (une minute), alors que le texte vient d'être écrit juste au-dessus.
 *
 * Vrai composant, vrai QueryClient ; seul HTTP est simulé.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import api from '@/utils/api';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AIInterpretationPanel from '@/components/AIInterpretationPanel';
import { savedInterpretationKey } from '@/hooks/useSavedInterpretation';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const DATASET_ID = 'ds-1';
const COMPARISON = 'KO_vs_WT';

const WRITTEN = {
  interpretation: 'Inflammation rises while the barrier falls.',
  cached: false,
  generated_at: '2026-11-26T10:00:00Z',
  model: 'gemma',
  summary: { deg_up: 1, deg_down: 1, top_pathways_count: 1, top_genes_count: 1 },
};

function serve({ postFails = false }: { postFails?: boolean } = {}) {
  mockApi.get.mockImplementation((url: string) => {
    if (url === '/users/me') {
      return Promise.resolve({
        data: { id: 'u1', email: 'a@b.c', role: 'USER', subscription_plan: 'TEAM' },
      });
    }
    if (url === '/datasets/ai/status') {
      return Promise.resolve({ data: { available: true, current_model: 'gemma' } });
    }
    if (url.endsWith('/conversations')) return Promise.resolve({ data: { conversations: [] } });
    if (url.endsWith('/interpretation')) return Promise.resolve({ data: null });
    return Promise.reject(new Error(`unexpected GET ${url}`));
  });
  mockApi.post.mockImplementation(() =>
    postFails ? Promise.reject(new Error('503')) : Promise.resolve({ data: WRITTEN })
  );
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AIInterpretationPanel datasetId={DATASET_ID} comparisonName={COMPARISON} />
      </ThemeProvider>
    </QueryClientProvider>
  );
  return { invalidate };
}

const invalidatedKeys = (spy: jest.SpyInstance) =>
  spy.mock.calls.map(([filters]) => (filters as { queryKey?: readonly unknown[] })?.queryKey);

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('AIInterpretationPanel — the saved reading the page reads', () => {
  it('invalidates the saved interpretation once a generation succeeded', async () => {
    serve();
    const { invalidate } = renderPanel();

    await userEvent.click(await screen.findByRole('button', { name: 'Generate Interpretation' }));

    await waitFor(() => expect(screen.getByText(WRITTEN.interpretation)).toBeInTheDocument());
    expect(invalidatedKeys(invalidate)).toContainEqual(savedInterpretationKey(DATASET_ID, COMPARISON));
  });

  it('does not invalidate it when the generation failed, nor before the click', async () => {
    serve({ postFails: true });
    const { invalidate } = renderPanel();

    const generate = await screen.findByRole('button', { name: 'Generate Interpretation' });
    expect(invalidatedKeys(invalidate)).not.toContainEqual(
      savedInterpretationKey(DATASET_ID, COMPARISON)
    );

    await userEvent.click(generate);
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Generate Interpretation' })).toBeInTheDocument()
    );
    expect(invalidatedKeys(invalidate)).not.toContainEqual(
      savedInterpretationKey(DATASET_ID, COMPARISON)
    );
  });
});
