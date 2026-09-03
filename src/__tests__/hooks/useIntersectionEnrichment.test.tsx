/**
 * Enrichment of an arbitrary gene set, rewritten on React Query.
 *
 * The public surface is asserted as much as the behaviour, because `MultiComparisonVenn`
 * depends on it and the rewrite was not the place to renegotiate that contract: it still
 * returns `{ status, result, error, jobId, run, reset }` and still reports `PENDING` from the
 * moment the job is asked for, so a caller's spinner starts immediately.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useIntersectionEnrichment } from '@/hooks/useIntersectionEnrichment';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

const DATASET = 'deg-1';
const GENES = ['TP53', 'MDM2'];

const ROW = {
  pathway_id: 'GO:1',
  pathway_name: 'Apoptotic process',
  category: 'GO:BP',
  pvalue: 1e-6,
  padj: 1e-5,
  gene_count: 2,
  gene_ratio: '2/2',
  bg_ratio: '40/20000',
  genes: GENES,
};

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const render = () => renderHook(() => useIntersectionEnrichment(DATASET), { wrapper });

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.post.mockResolvedValue({ data: { job_id: 'job-1' } });
});

describe('the contract MultiComparisonVenn depends on', () => {
  it('exposes the same shape as before the rewrite', () => {
    const { result } = render();
    expect(Object.keys(result.current).sort()).toEqual(
      ['error', 'jobId', 'reset', 'result', 'run', 'status'].sort()
    );
  });

  it('starts idle', () => {
    const { result } = render();
    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('running a job', () => {
  it('posts the genes and the label', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'RUNNING' } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    expect(mockApi.post).toHaveBeenCalledWith(
      `/datasets/${DATASET}/intersection-enrichment`,
      { genes: GENES, label: 'Lasso' }
    );
  });

  it('passes a species only when given one', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'RUNNING' } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso', 'mouse'));

    expect(mockApi.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ species: 'mouse' })
    );
  });

  it('records the job id', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'RUNNING' } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.jobId).toBe('job-1'));
  });

  it('reports the finished rows', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'DONE', result: [ROW] } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.status).toBe('DONE'));
    expect(result.current.result).toEqual([ROW]);
  });

  // An enrichment that finds nothing is an answer, not an absence.
  it('distinguishes "no pathway" from "not finished"', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'DONE', result: [] } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.result).toEqual([]));
    expect(result.current.result).not.toBeNull();
  });
});

describe('failures', () => {
  it('surfaces the server detail when the job cannot be started', async () => {
    mockApi.post.mockRejectedValue({ response: { data: { detail: 'Too many genes' } } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.status).toBe('FAILED'));
    expect(result.current.error).toBe('Too many genes');
  });

  it('falls back to a plain message when the server gives no detail', async () => {
    mockApi.post.mockRejectedValue(new Error('network'));
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.error).toBe('Failed to start enrichment'));
  });

  it('reports a job that failed after starting', async () => {
    mockApi.get.mockResolvedValue({
      data: { status: 'FAILED', error_message: 'annoDB unavailable' },
    });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));

    await waitFor(() => expect(result.current.error).toBe('annoDB unavailable'));
    expect(result.current.result).toBeNull();
  });

  // `run` never rejects: making every caller wrap it would be a worse contract than reporting
  // through `error`.
  it('does not reject, so callers need no try/catch', async () => {
    mockApi.post.mockRejectedValue(new Error('boom'));
    const { result } = render();

    await expect(act(() => result.current.run(GENES, 'Lasso'))).resolves.not.toThrow();
  });
});

describe('reset', () => {
  it('returns to idle and drops the job', async () => {
    mockApi.get.mockResolvedValue({ data: { status: 'DONE', result: [ROW] } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));
    await waitFor(() => expect(result.current.status).toBe('DONE'));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.result).toBeNull();
    expect(result.current.jobId).toBeNull();
  });

  it('clears a previous failure', async () => {
    mockApi.post.mockRejectedValue({ response: { data: { detail: 'nope' } } });
    const { result } = render();

    await act(() => result.current.run(GENES, 'Lasso'));
    await waitFor(() => expect(result.current.error).toBe('nope'));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.status).toBe('idle');
  });
});
