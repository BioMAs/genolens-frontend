import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import React from 'react';

import {
  cancelAnalysisErrorMessage,
  useCancelAnalysis,
} from '@/hooks/useAnalyses';
import CancelAnalysisButton from '@/components/analyses/CancelAnalysisButton';
import AnalysisStatusCard from '@/components/analyses/AnalysisStatusCard';
import { SelfServiceAnalysis, SelfServiceAnalysisStatus } from '@/types';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import api from '@/utils/api';

const mockedApi = api as jest.Mocked<typeof api>;

function makeAnalysis(overrides: Partial<SelfServiceAnalysis> = {}): SelfServiceAnalysis {
  return {
    id: 'a-1',
    project_id: 'p-1',
    name: 'Tumour vs normal',
    status: SelfServiceAnalysisStatus.RUNNING,
    current_step: 'running_pipeline',
    progress_log: [],
    error_message: null,
    created_at: '2026-09-29T12:00:00Z',
    updated_at: '2026-09-29T12:00:00Z',
    ...overrides,
  } as SelfServiceAnalysis;
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function withClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function httpError(status: number, detail?: string) {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: detail ? { detail } : {} },
  });
}

describe('useCancelAnalysis', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs to /analyses/{id}/cancel via the shared client and caches the CANCELLED status', async () => {
    const cancelled = makeAnalysis({ status: SelfServiceAnalysisStatus.CANCELLED });
    mockedApi.post.mockResolvedValue({ data: cancelled });
    mockedApi.get.mockResolvedValue({ data: cancelled });
    const qc = makeClient();
    qc.setQueryData(['analysis', 'a-1'], makeAnalysis());
    const invalidate = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCancelAnalysis(), { wrapper: withClient(qc) });
    await act(async () => {
      await result.current.mutateAsync('a-1');
    });

    expect(mockedApi.post).toHaveBeenCalledWith('/analyses/a-1/cancel');
    expect(mockedApi.delete).not.toHaveBeenCalled();
    expect(qc.getQueryData<SelfServiceAnalysis>(['analysis', 'a-1'])?.status).toBe(
      SelfServiceAnalysisStatus.CANCELLED,
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['analyses', 'p-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['analysis', 'a-1'] });
  });

  it('surfaces the failure and refetches the real status', async () => {
    mockedApi.post.mockRejectedValue(
      httpError(409, 'Analysis has already finished and can no longer be cancelled'),
    );
    const qc = makeClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCancelAnalysis(), { wrapper: withClient(qc) });
    act(() => result.current.mutate('a-1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cancelAnalysisErrorMessage(result.current.error)).toBe(
      'Analysis has already finished and can no longer be cancelled',
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['analysis', 'a-1'] });
  });
});

describe('cancelAnalysisErrorMessage', () => {
  it('uses the FastAPI detail, or a generic message without one', () => {
    expect(cancelAnalysisErrorMessage(new Error('Network Error'))).toBe(
      'Could not cancel the analysis. Please try again.',
    );
    expect(
      cancelAnalysisErrorMessage(httpError(403, 'Only the launcher or a project admin can cancel')),
    ).toBe('Only the launcher or a project admin can cancel');
  });
});

describe('CancelAnalysisButton', () => {
  let confirmSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    confirmSpy = jest.spyOn(window, 'confirm');
  });
  afterEach(() => confirmSpy.mockRestore());

  it('does nothing when the confirmation is declined', () => {
    confirmSpy.mockReturnValue(false);
    render(<CancelAnalysisButton analysisId="a-1" />, { wrapper: withClient(makeClient()) });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('shows a pending state, then the error message on failure', async () => {
    confirmSpy.mockReturnValue(true);
    let reject!: (e: unknown) => void;
    mockedApi.post.mockReturnValue(
      new Promise((_, r) => {
        reject = r;
      }),
    );
    render(<CancelAnalysisButton analysisId="a-1" />, { wrapper: withClient(makeClient()) });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    const button = await screen.findByRole('button', { name: /cancelling/i });
    expect(button).toBeDisabled();

    await act(async () => reject(httpError(500)));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not cancel the analysis. Please try again.',
    );
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeEnabled();
  });
});

describe('AnalysisStatusCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cancels a running analysis instead of deleting it', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockedApi.post.mockResolvedValue({
      data: makeAnalysis({ status: SelfServiceAnalysisStatus.CANCELLED }),
    });
    render(<AnalysisStatusCard analysis={makeAnalysis()} projectId="p-1" />, {
      wrapper: withClient(makeClient()),
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/analyses/a-1/cancel'));
    expect(mockedApi.delete).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
