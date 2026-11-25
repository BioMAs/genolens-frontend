/**
 * Builders for the `AuthResult` values the auth client resolves to, so a test
 * can script `login`, `verifyMfa`... without spelling out the whole union.
 *
 * Not named `use*` and kept out of `__tests__`: Jest must not take it for a
 * test file.
 */
import type { AuthResult } from '@/utils/auth/client';

/** A call the API accepted. */
export function authOk<T>(data: T, status = 200): AuthResult<T> {
  return { ok: true, status, data };
}

/**
 * A call the API refused. `extra` is merged into the parsed body next to
 * `detail`, like the `attempts_left` an `invalid_code` answer carries.
 * `status: 0` with a null `detail` is the "API not reachable" outcome.
 */
export function authRefused(
  status: number,
  detail: string | null,
  extra: Record<string, unknown> = {},
): AuthResult<never> {
  return { ok: false, status, detail, body: { detail, ...extra } };
}
