/**
 * Recognising the AI-cap refusal.
 *
 * Once a capped (demo) account has used its AI requests, every AI endpoint
 * answers 429 with a STRUCTURED detail:
 * `{"detail": {"error": "ai_quota_exhausted", "limit", "used", "message"}}`.
 * The UI branches on `detail.error`, not on the status alone — a 429 can mean
 * something else — and must never print the object as "[object Object]".
 */
import {
  AI_QUOTA_COPY,
  PLAN_GATE_COPY,
  aiQuotaMessage,
  apiErrorMessage,
  isAiQuotaExhausted,
} from '@/utils/plan';
import { SUPPORT_EMAIL } from '@/lib/contact';

const QUOTA_DETAIL = {
  error: 'ai_quota_exhausted',
  limit: 20,
  used: 20,
  message: 'You have used all 20 AI requests of this demo account.',
};

/** The shape axios rejects with. */
const axiosError = (status: number, detail: unknown) => ({
  isAxiosError: true,
  message: `Request failed with status code ${status}`,
  response: { status, data: { detail } },
});

describe('isAiQuotaExhausted', () => {
  it('recognises the axios 429 carrying ai_quota_exhausted', () => {
    expect(isAiQuotaExhausted(axiosError(429, QUOTA_DETAIL))).toBe(true);
  });

  it('recognises the plain { status, detail } shape of a fetch-based caller', () => {
    // The chat streams over fetch, not axios: it builds this shape itself.
    expect(isAiQuotaExhausted({ status: 429, detail: QUOTA_DETAIL })).toBe(true);
  });

  it('ignores a 429 that is not the AI cap', () => {
    expect(isAiQuotaExhausted(axiosError(429, 'Too many requests'))).toBe(false);
    expect(isAiQuotaExhausted(axiosError(429, { error: 'rate_limited' }))).toBe(false);
  });

  it('ignores the same detail under another status', () => {
    expect(isAiQuotaExhausted(axiosError(403, QUOTA_DETAIL))).toBe(false);
  });

  it('ignores anything that is not an API error', () => {
    for (const value of [null, undefined, 'boom', 429, new Error('network'), {}]) {
      expect(isAiQuotaExhausted(value)).toBe(false);
    }
  });
});

describe('aiQuotaMessage', () => {
  it("uses the backend's own wording when it sent one", () => {
    expect(aiQuotaMessage(axiosError(429, QUOTA_DETAIL))).toBe(QUOTA_DETAIL.message);
  });

  it('falls back to our copy when the backend sent no message', () => {
    const { message: _omit, ...withoutMessage } = QUOTA_DETAIL;
    void _omit;
    expect(aiQuotaMessage(axiosError(429, withoutMessage))).toBe(AI_QUOTA_COPY.body);
  });
});

describe('AI_QUOTA_COPY', () => {
  it('points to the support address rather than to an upgrade', () => {
    // A demo account already has the plan: what ran out is the demo's own
    // allowance, so the plan gate copy would send it nowhere useful.
    expect(AI_QUOTA_COPY.title).toBe('AI request limit reached');
    expect(AI_QUOTA_COPY.body).toContain(SUPPORT_EMAIL);
    expect(Object.values(PLAN_GATE_COPY)).not.toContain(AI_QUOTA_COPY.body);
  });
});

describe('apiErrorMessage', () => {
  it('reads a string detail', () => {
    expect(apiErrorMessage(axiosError(500, 'LLM timeout'))).toBe('LLM timeout');
  });

  it("reads a structured detail's message instead of printing the object", () => {
    expect(apiErrorMessage(axiosError(429, QUOTA_DETAIL))).toBe(QUOTA_DETAIL.message);
  });

  it('returns undefined when there is nothing readable', () => {
    expect(apiErrorMessage(axiosError(500, { error: 'x' }))).toBeUndefined();
    expect(apiErrorMessage(new Error('network'))).toBeUndefined();
    expect(apiErrorMessage(axiosError(500, ''))).toBeUndefined();
  });
});
