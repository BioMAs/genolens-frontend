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
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { useChatAgent } from '@/hooks/useChatAgent';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: { id: 'session-1' } })) },
}));

const API = 'http://api.example.test/api/v1';
const QUOTA_MESSAGE = 'You have used all 20 AI requests of this demo account.';

const initialApiUrl = process.env.NEXT_PUBLIC_API_URL;
const initialFetch = global.fetch;
const initialTextDecoder = global.TextDecoder;
const fetchMock = jest.fn();

/** A refused call: what the hook reads is the status and the body text. */
function refusal(status: number, body: string) {
  return {
    ok: false,
    status,
    body: null,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(JSON.parse(body)),
    clone() {
      return this;
    },
  } as unknown as Response;
}

/** The answer to `POST /auth/refresh`: all `authPost` reads is `ok`, `status` and `json()`. */
function refreshed(): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ refreshed: true }),
  } as unknown as Response;
}

/** A 200 answer streaming the given SSE frames, one chunk each. */
function stream(frames: string[]): Response {
  const encoder = new NodeTextEncoder();
  const chunks = frames.map((frame) => encoder.encode(frame));
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () =>
          Promise.resolve(
            chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined },
          ),
      }),
    },
  } as unknown as Response;
}

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

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  // jsdom has no TextDecoder, which the stream reader needs.
  global.TextDecoder = NodeTextDecoder as unknown as typeof TextDecoder;
});

afterEach(() => {
  global.fetch = initialFetch;
  global.TextDecoder = initialTextDecoder;
  if (initialApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
  else process.env.NEXT_PUBLIC_API_URL = initialApiUrl;
});

it('streams with cookies and the client header, without a token', async () => {
  fetchMock.mockResolvedValueOnce(
    stream(['event: token\ndata: {"text":"Hello"}\n\n', 'event: done\ndata: {}\n\n']),
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
      stream(['event: token\ndata: {"text":"Back"}\n\n', 'event: done\ndata: {}\n\n']),
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

it('surfaces the original refusal, once, when the session cannot be renewed', async () => {
  const unauthorised = JSON.stringify({ detail: 'invalid_token' });
  fetchMock
    .mockResolvedValueOnce(refusal(401, unauthorised))
    .mockResolvedValueOnce(refusal(401, JSON.stringify({ detail: 'invalid_refresh' })));
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('hi');
  });

  expect(fetchMock).toHaveBeenCalledTimes(2); // no replay, no loop
  expect(result.current.error).toBe(`Chat request failed: 401 – ${unauthorised}`);
  expect(result.current.isStreaming).toBe(false);
  expect(result.current.messages.at(-1)?.pending).toBe(false);
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
