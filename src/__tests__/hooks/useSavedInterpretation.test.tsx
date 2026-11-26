/**
 * La lecture IA déjà produite, pour la page de lecture.
 *
 * Ce hook ne doit JAMAIS déclencher une génération : chaque génération consomme une requête IA
 * sur un compte plafonné. Il lit ce qui existe, et ne sait rien faire d'autre — d'où les
 * assertions sur `api.post`, qui est l'appel d'une génération.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useSavedInterpretation } from '@/hooks/useSavedInterpretation';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const URL = '/datasets/ds-1/comparisons/Treated%20vs%20Control/interpretation';

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

const read = (enabled = true) =>
  renderHook(() => useSavedInterpretation('ds-1', 'Treated vs Control', enabled), {
    wrapper: makeWrapper().wrapper,
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSavedInterpretation', () => {
  it('rend le texte enregistré, par un simple GET', async () => {
    mockApi.get.mockResolvedValue({ data: { interpretation: 'Inflammation programme is up.' } });
    const { result } = read();

    await waitFor(() => expect(result.current.text).toBe('Inflammation programme is up.'));
    expect(mockApi.get).toHaveBeenCalledWith(URL);
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('rend isLoading tant que la réponse est en route', async () => {
    mockApi.get.mockResolvedValue({ data: { interpretation: 'Texte.' } });
    const { result } = read();

    expect(result.current).toEqual({ text: null, isLoading: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it("rend null sur un 404 : pas de lecture, ce n'est pas une erreur", async () => {
    mockApi.get.mockRejectedValue({ response: { status: 404, data: { detail: 'Not found' } } });
    const { result } = read();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.text).toBeNull();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('rend null quand la réponse existe mais sans interpretation', async () => {
    mockApi.get.mockResolvedValue({ data: { interpretation: null } });
    const first = read();
    await waitFor(() => expect(first.result.current.isLoading).toBe(false));
    expect(first.result.current.text).toBeNull();

    mockApi.get.mockResolvedValue({ data: {} });
    const second = read();
    await waitFor(() => expect(second.result.current.isLoading).toBe(false));
    expect(second.result.current.text).toBeNull();

    mockApi.get.mockResolvedValue({ data: { interpretation: '' } });
    const third = read();
    await waitFor(() => expect(third.result.current.isLoading).toBe(false));
    expect(third.result.current.text).toBeNull();

    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('rend null sur toute autre erreur, sans rien générer', async () => {
    mockApi.get.mockRejectedValue({ response: { status: 500 } });
    const { result } = read();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.text).toBeNull();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('rend null sur une erreur réseau sans réponse', async () => {
    mockApi.get.mockRejectedValue(new Error('Network Error'));
    const { result } = read();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.text).toBeNull();
  });

  it("n'envoie aucune requête quand enabled est faux", () => {
    const { result } = read(false);

    expect(mockApi.get).not.toHaveBeenCalled();
    expect(mockApi.post).not.toHaveBeenCalled();
    expect(result.current).toEqual({ text: null, isLoading: false });
  });

  it("n'envoie aucune requête sans comparaison", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useSavedInterpretation('ds-1', '', true), { wrapper });

    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('partage une seule requête entre deux lecteurs de la même comparaison', async () => {
    mockApi.get.mockResolvedValue({ data: { interpretation: 'Texte.' } });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () => ({
        a: useSavedInterpretation('ds-1', 'Treated vs Control', true),
        b: useSavedInterpretation('ds-1', 'Treated vs Control', true),
      }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.a.text).toBe('Texte.'));
    expect(result.current.b.text).toBe('Texte.');
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });
});
