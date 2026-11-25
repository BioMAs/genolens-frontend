/**
 * Test doubles for code that talks to the API over a global `fetch` (the SSE
 * hooks, which go through `authedFetch`).
 *
 * jsdom has neither `fetch`, `Response` nor `TextDecoder`, so the answers are
 * plain objects carrying only what the code under test reads, and the global
 * `fetch` is replaced for the length of each test. The real `authedFetch` runs
 * over them: that is what proves a session is renewed and the call replayed.
 *
 * Not named `use*`: `installFakeFetch` registers Jest hooks, it is not a React
 * hook, and the hooks lint rule would otherwise reject it at module level.
 */
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';

/** A refused call: what the code reads is the status and the body text. */
export function refusal(status: number, body: string): Response {
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
export function refreshed(): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ refreshed: true }),
  } as unknown as Response;
}

/** A 200 answer streaming the given text chunks, one `read()` each. */
export function sseResponse(chunks: string[]): Response {
  const encoder = new NodeTextEncoder();
  const queue = chunks.map((chunk) => encoder.encode(chunk));
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: () =>
          Promise.resolve(
            queue.length ? { done: false, value: queue.shift() } : { done: true, value: undefined },
          ),
      }),
    },
  } as unknown as Response;
}

const globals = globalThis as unknown as Record<string, unknown>;

/** Puts a global back as it was, removing it when there was none (jsdom has no `fetch`). */
function restoreGlobal(name: string, value: unknown): void {
  if (value === undefined) delete globals[name];
  else globals[name] = value;
}

/**
 * Call once at the top of a test file. For each test it points
 * `NEXT_PUBLIC_API_URL` at `apiUrl`, replaces the global `fetch` with a fresh
 * mock (returned: queue answers on it) and provides Node's `TextDecoder`, which
 * the stream readers need; afterwards it puts all three back.
 */
export function installFakeFetch(apiUrl: string): jest.Mock {
  const fetchMock = jest.fn();
  let saved: { fetch: unknown; textDecoder: unknown; apiUrl: string | undefined };

  beforeEach(() => {
    saved = {
      fetch: globals.fetch,
      textDecoder: globals.TextDecoder,
      apiUrl: process.env.NEXT_PUBLIC_API_URL,
    };
    process.env.NEXT_PUBLIC_API_URL = apiUrl;
    fetchMock.mockReset();
    globals.fetch = fetchMock;
    globals.TextDecoder = NodeTextDecoder;
  });

  afterEach(() => {
    restoreGlobal('fetch', saved.fetch);
    restoreGlobal('TextDecoder', saved.textDecoder);
    if (saved.apiUrl === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = saved.apiUrl;
  });

  return fetchMock;
}
