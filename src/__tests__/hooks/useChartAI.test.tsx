/**
 * The chart AI panel streams over `fetch` (interpretation, then follow-up
 * questions): through `authedFetch`, so the calls carry the session cookies and
 * the client header, never a token, and an expired session is renewed before
 * the call is replayed. The real `authedFetch` runs here over a faked global
 * `fetch`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { useChartAI } from '@/hooks/useChartAI';
import { installFakeFetch, refreshed, refusal, sseResponse } from '@/test-utils/fetchDoubles';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { get: jest.fn(() => Promise.resolve({ data: { messages: [] } })) },
}));

const API = 'http://api.example.test/api/v1';

const fetchMock = installFakeFetch(API);

/** A 200 answer streaming the given events as `data:` lines, one chunk each. */
function stream(events: Record<string, unknown>[]): Response {
  return sseResponse(events.map((event) => `data: ${JSON.stringify(event)}\n`));
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () =>
      useChartAI({
        datasetId: 'd1',
        chartType: 'volcano',
        contextKey: 'A_vs_B',
        context: { threshold: 0.05 },
      }),
    { wrapper },
  );
}

it('streams the interpretation with cookies and the client header, without a token', async () => {
  fetchMock.mockResolvedValueOnce(stream([{ text: 'Genes ' }, { text: 'up' }, { done: true }]));
  const { result } = renderPanel();

  await act(async () => {
    await result.current.interpret();
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${API}/datasets/d1/ai/interpret-stream`);
  expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  const headers = init.headers as Headers;
  expect(headers.get('X-GenoLens-Client')).toBe('web');
  expect(headers.get('Authorization')).toBeNull();

  expect(result.current.interpretation).toBe('Genes up');
  expect(result.current.interpretError).toBeNull();
});

it('renews an expired session, then replays the interpretation once', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_token' })))
    .mockResolvedValueOnce(refreshed())
    .mockResolvedValueOnce(stream([{ text: 'Renewed' }, { done: true }]));
  const { result } = renderPanel();

  await act(async () => {
    await result.current.interpret();
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `${API}/datasets/d1/ai/interpret-stream`,
    `${API}/auth/refresh`,
    `${API}/datasets/d1/ai/interpret-stream`,
  ]);
  expect(result.current.interpretation).toBe('Renewed');
  expect(result.current.interpretError).toBeNull();
});

it('renews an expired session before a follow-up question', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_token' })))
    .mockResolvedValueOnce(refreshed())
    .mockResolvedValueOnce(stream([{ text: 'Because ' }, { text: 'of p53' }, { done: true }]));
  const { result } = renderPanel();

  let answer: { answer: string } | undefined;
  await act(async () => {
    answer = await result.current.ask('Why?');
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `${API}/datasets/d1/ai/ask-stream`,
    `${API}/auth/refresh`,
    `${API}/datasets/d1/ai/ask-stream`,
  ]);
  const replay = fetchMock.mock.calls[2][1];
  expect(replay.credentials).toBe('include');
  expect((replay.headers as Headers).get('Authorization')).toBeNull();
  expect(JSON.parse(replay.body)).toMatchObject({ question: 'Why?', chart_type: 'volcano' });
  expect(answer).toEqual({ answer: 'Because of p53' });
});

it('surfaces the refusal, once, when the session cannot be renewed', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_token' })))
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_refresh' })));
  const { result } = renderPanel();

  await act(async () => {
    await result.current.interpret();
  });

  expect(fetchMock).toHaveBeenCalledTimes(2); // no replay, no loop
  expect(result.current.interpretError).toBe(
    'AI request failed: 401 – {"detail":"invalid_token"}',
  );
  expect(result.current.isInterpreting).toBe(false);
});
