/**
 * The chat assistant's transport and its handling of refusals.
 *
 * The chat streams over `fetch`, not axios, so it does not get axios's error
 * shape or cookie handling for free: it goes through `authedFetch`, which sends
 * the session cookies and the client header, never a token, and renews an
 * expired session before replaying the call. The real `authedFetch` runs here
 * over a faked global `fetch`, which is what proves the renewal.
 *
 * The backend refuses a capped account with a real 429 BEFORE the stream
 * opens; the hook must read the JSON body and surface the quota message,
 * instead of `Chat request failed: 429 – {raw body}`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { useChatAgent } from '@/hooks/useChatAgent';
import { installFakeFetch, refreshed, refusal, sseResponse } from '@/test-utils/fetchDoubles';
import { SESSION_EXPIRED } from '@/utils/auth/messages';
import { navigate } from '@/utils/auth/navigation';

jest.mock('@/utils/auth/navigation', () => ({ navigate: jest.fn() }));
jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: { id: 'session-1' } })) },
}));

const API = 'http://api.example.test/api/v1';
const QUOTA_MESSAGE = 'You have used all 20 AI requests of this demo account.';

const fetchMock = installFakeFetch(API);
const mockNavigate = navigate as jest.Mock;

beforeEach(() => {
  mockNavigate.mockReset();
  window.history.pushState({}, '', '/projects/p1?tab=2');
});

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => useChatAgent({ projectId: 'p1', datasetId: 'd1', comparisonName: 'A_vs_B' }),
    { wrapper },
  );
}

it('streams with cookies and the client header, without a token', async () => {
  fetchMock.mockResolvedValueOnce(
    sseResponse(['event: token\ndata: {"text":"Hello"}\n\n', 'event: done\ndata: {}\n\n']),
  );
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${API}/chat/sessions/session-1/message`);
  expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
  const headers = init.headers as Headers;
  expect(headers.get('X-GenoLens-Client')).toBe('web');
  expect(headers.get('Content-Type')).toBe('application/json');
  expect(headers.get('Authorization')).toBeNull();
  expect(init.body).toBe(JSON.stringify({ message: 'hi' }));

  expect(result.current.error).toBeNull();
  expect(result.current.messages.at(-1)).toMatchObject({ role: 'assistant', content: 'Hello', pending: false });
});

it('renews an expired session before streaming', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_token' })))
    .mockResolvedValueOnce(refreshed())
    .mockResolvedValueOnce(
      sseResponse(['event: token\ndata: {"text":"Back"}\n\n', 'event: done\ndata: {}\n\n']),
    );
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `${API}/chat/sessions/session-1/message`,
    `${API}/auth/refresh`,
    `${API}/chat/sessions/session-1/message`,
  ]);
  // The replay carries the same question, once.
  expect(fetchMock.mock.calls[2][1].body).toBe(JSON.stringify({ message: 'hi' }));
  expect(result.current.error).toBeNull();
  expect(result.current.messages.at(-1)).toMatchObject({ content: 'Back', pending: false });
});

// The renewal was refused: the session is over. The visitor reads that in words, not
// as the raw refusal, and is sent to sign in again, back to this page afterwards.
it('says the session has expired, once, and offers the sign-in, when it cannot be renewed', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_token' })))
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_refresh' })));
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(fetchMock).toHaveBeenCalledTimes(2); // no replay, no loop
  expect(result.current.error).toBe(SESSION_EXPIRED);
  expect(result.current.error).not.toMatch(/401|invalid_token/);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
  expect(mockNavigate).toHaveBeenCalledWith('/?next=%2Fprojects%2Fp1%3Ftab%3D2');
  expect(result.current.isStreaming).toBe(false);
  expect(result.current.messages.at(-1)?.pending).toBe(false);
});

it('treats the pre-launch 403 "Not authenticated" the same way', async () => {
  fetchMock
    .mockResolvedValueOnce(refusal(403, JSON.stringify({ detail: 'Not authenticated' })))
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_refresh' })));
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(result.current.error).toBe(SESSION_EXPIRED);
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

it('does not send anyone to sign in for a refusal that is not a sign-out', async () => {
  fetchMock.mockResolvedValueOnce(
    refusal(403, JSON.stringify({ detail: 'csrf_header_missing' })),
  );
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(result.current.error).toMatch(/^Chat request failed: 403/);
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('surfaces the quota message on the AI-cap 429', async () => {
  fetchMock.mockResolvedValueOnce(
    refusal(
      429,
      JSON.stringify({
        detail: { error: 'ai_quota_exhausted', limit: 20, used: 20, message: QUOTA_MESSAGE },
      }),
    ),
  );
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('How many genes are up-regulated?');
  });

  expect(result.current.error).toBe(QUOTA_MESSAGE);
  expect(result.current.quotaExhausted).toBe(true);
  expect(result.current.isStreaming).toBe(false);
  // The pending assistant bubble is closed, not left spinning.
  expect(result.current.messages.at(-1)?.pending).toBe(false);
});

it('keeps the generic failure message for any other refusal', async () => {
  fetchMock.mockResolvedValueOnce(refusal(500, 'Internal Server Error'));
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('Hello');
  });

  expect(result.current.error).toBe('Chat request failed: 500 – Internal Server Error');
  expect(result.current.quotaExhausted).toBe(false);
});
