/**
 * Le retraitement DEG, tel que `ComparisonDetail` le lançait depuis le menu de son en-tête : la
 * même requête (`POST /datasets/{id}/reprocess`), le même sondage (toutes les 5 s, 10 min au plus)
 * et les mêmes messages. La lecture le porte dans la vue « Methods » jusqu'au lot 4.
 */
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import api from '@/utils/api';
import { useReprocessDeg } from '@/hooks/useReprocessDeg';
import { DatasetStatus } from '@/types';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useReprocessDeg('deg-1', 'p1'), { wrapper });
  return { ...hook, invalidate };
}

const status = (value: DatasetStatus) => ({ data: { id: 'deg-1', status: value } });

/** Avance d'un tour de sondage et laisse ses promesses se résoudre. */
const poll = async () => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5000);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockApi.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useReprocessDeg', () => {
  it('is idle until started', () => {
    const { result } = setup();
    expect(result.current.reprocessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('posts the reprocess request of the DEG dataset, then polls it until it is ready', async () => {
    mockApi.get.mockResolvedValueOnce(status(DatasetStatus.PROCESSING));
    mockApi.get.mockResolvedValueOnce(status(DatasetStatus.READY));
    const { result, invalidate } = setup();

    await act(async () => {
      result.current.start();
    });
    expect(mockApi.post).toHaveBeenCalledWith('/datasets/deg-1/reprocess');
    expect(result.current.reprocessing).toBe(true);

    await poll();
    expect(mockApi.get).toHaveBeenLastCalledWith('/datasets/deg-1');
    expect(result.current.reprocessing).toBe(true);

    await poll();
    expect(result.current.reprocessing).toBe(false);
    expect(result.current.error).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['datasets', 'project', 'p1'] });

    // Le sondage s'arrête une fois le jeu prêt.
    await poll();
    expect(mockApi.get).toHaveBeenCalledTimes(2);
  });

  it('says the regeneration failed when the dataset does', async () => {
    mockApi.get.mockResolvedValue(status(DatasetStatus.FAILED));
    const { result } = setup();
    await act(async () => {
      result.current.start();
    });
    await poll();
    expect(result.current.reprocessing).toBe(false);
    expect(result.current.error).toBe('Heatmap regeneration failed');
  });

  it('says it could not start when the request is refused', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockApi.post.mockRejectedValue(new Error('500'));
    const { result } = setup();
    await act(async () => {
      result.current.start();
    });
    expect(result.current.reprocessing).toBe(false);
    expect(result.current.error).toBe('Failed to start heatmap regeneration');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('gives up after ten minutes of polling', async () => {
    mockApi.get.mockResolvedValue(status(DatasetStatus.PROCESSING));
    const { result } = setup();
    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(120 * 5000);
    });
    expect(mockApi.get).toHaveBeenCalledTimes(120);
    expect(result.current.reprocessing).toBe(false);
    expect(result.current.error).toBe('Heatmap regeneration timed out after 10 minutes');
  });

  it('does not start a second reprocessing while one runs', async () => {
    mockApi.get.mockResolvedValue(status(DatasetStatus.PROCESSING));
    const { result } = setup();
    await act(async () => {
      result.current.start();
    });
    await act(async () => {
      result.current.start();
    });
    expect(mockApi.post).toHaveBeenCalledTimes(1);
  });

  it('clears the last error when started again', async () => {
    mockApi.get.mockResolvedValueOnce(status(DatasetStatus.FAILED));
    const { result } = setup();
    await act(async () => {
      result.current.start();
    });
    await poll();
    expect(result.current.error).toBe('Heatmap regeneration failed');

    mockApi.get.mockResolvedValue(status(DatasetStatus.PROCESSING));
    await act(async () => {
      result.current.start();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.reprocessing).toBe(true);
  });

  it('stops polling when the page goes away', async () => {
    mockApi.get.mockResolvedValue(status(DatasetStatus.PROCESSING));
    const { result, unmount } = setup();
    await act(async () => {
      result.current.start();
    });
    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('does not start polling when the page went away while the request was on its way', async () => {
    let accept: (value: unknown) => void = () => {};
    mockApi.post.mockReturnValue(new Promise((resolve) => (accept = resolve)));
    mockApi.get.mockResolvedValue(status(DatasetStatus.PROCESSING));
    const { result, unmount } = setup();
    act(() => result.current.start());
    unmount();
    await act(async () => {
      accept({ data: {} });
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});
