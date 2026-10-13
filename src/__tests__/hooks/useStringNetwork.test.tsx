/**
 * A STRING failure must not read as an empty network.
 *
 * The endpoint reports upstream failures inside a 200 — `{nodes: [], edges: [], error}` — and
 * the hook used to hand that over as data, so the panel said "no interaction at this confidence"
 * when STRING had in fact recognised none of the genes, or could not be reached.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { StringNetworkError, useStringNetwork } from '@/hooks/useStringNetwork';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

it('returns the network when STRING answered', async () => {
  mockApi.post.mockResolvedValue({
    data: {
      nodes: [{ id: 'TP53', name: 'TP53' }, { id: 'MDM2', name: 'MDM2' }],
      edges: [{ source: 'TP53', target: 'MDM2', score: 0.99 }],
    },
  });

  const { result } = renderHook(() => useStringNetwork({ symbols: ['TP53'], species: 10090 }), {
    wrapper,
  });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.nodes).toHaveLength(2);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/integrations/string/network',
    expect.objectContaining({ gene_symbols: ['TP53'], species: 10090 })
  );
});

it('fails as not-found, without retrying, when STRING knew none of the genes', async () => {
  mockApi.post.mockResolvedValue({ data: { nodes: [], edges: [], error: 'not_found' } });

  const { result } = renderHook(() => useStringNetwork({ symbols: ['NOT_A_GENE'] }), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(result.current.error).toBeInstanceOf(StringNetworkError);
  expect((result.current.error as StringNetworkError).kind).toBe('not-found');
  expect(mockApi.post).toHaveBeenCalledTimes(1);
});

// What the endpoint said before it learnt the `not_found` code: httpx's own message.
it('recognises a raw 404 message as not-found too', async () => {
  mockApi.post.mockResolvedValue({
    data: { nodes: [], edges: [], error: "Client error '404 Not Found' for url '…'" },
  });

  const { result } = renderHook(() => useStringNetwork({ symbols: ['X'] }), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true));
  expect((result.current.error as StringNetworkError).kind).toBe('not-found');
});

it('fails as unreachable for any other reported error', async () => {
  mockApi.post.mockResolvedValue({ data: { nodes: [], edges: [], error: 'timeout' } });

  const { result } = renderHook(() => useStringNetwork({ symbols: ['TP53'] }), { wrapper });

  await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 4000 });
  expect((result.current.error as StringNetworkError).kind).toBe('unreachable');
});
