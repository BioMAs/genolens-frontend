/**
 * The chat assistant's handling of the AI-cap refusal.
 *
 * The chat streams over `fetch`, not axios, so it does not get axios's error
 * shape for free. The backend refuses a capped account with a real 429 BEFORE
 * the stream opens; the hook must read the JSON body and surface the quota
 * message, instead of `Chat request failed: 429 – {raw body}`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

import { useChatAgent } from '@/hooks/useChatAgent';

jest.mock('@/utils/api', () => ({
  __esModule: true,
  default: { post: jest.fn(() => Promise.resolve({ data: { id: 'session-1' } })) },
}));

jest.mock('@/utils/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) },
  }),
}));

const QUOTA_MESSAGE = 'You have used all 20 AI requests of this demo account.';

function respondWith(status: number, body: string) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: false, status, body: null, text: () => Promise.resolve(body) }),
  ) as unknown as typeof fetch;
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

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

it('surfaces the quota message on the AI-cap 429', async () => {
  respondWith(
    429,
    JSON.stringify({
      detail: { error: 'ai_quota_exhausted', limit: 20, used: 20, message: QUOTA_MESSAGE },
    }),
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
  respondWith(500, 'Internal Server Error');
  const { result } = renderChat();

  await act(async () => {
    await result.current.send('Hello');
  });

  expect(result.current.error).toBe('Chat request failed: 500 – Internal Server Error');
  expect(result.current.quotaExhausted).toBe(false);
});
