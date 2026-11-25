/** @jest-environment node */
/**
 * The response headers `next.config.ts` adds. Every page refuses to be framed
 * by another site (clickjacking: a sign-in form or a "revoke this device"
 * button under a decoy page), with the modern header and the legacy one for
 * browsers that ignore `frame-ancestors`.
 *
 * Routes are matched the way Next matches a `source` (`getPathMatch`).
 */
import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match';

import config from '../../next.config';

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function headersFor(pathname: string): Promise<Record<string, string>> {
  const rules = ((await config.headers?.()) ?? []) as HeaderRule[];
  const found: Record<string, string> = {};
  for (const rule of rules) {
    if (getPathMatch(rule.source)(pathname) === false) continue;
    for (const { key, value } of rule.headers) found[key.toLowerCase()] = value;
  }
  return found;
}

it.each([
  '/',
  '/dashboard',
  '/projects/p1/comparisons/Treated.1_vs_Ctrl',
  '/auth/2fa/setup',
  '/auth/reset',
  '/profile',
])('forbids framing on %s', async (pathname) => {
  const headers = await headersFor(pathname);

  expect(headers['content-security-policy']).toBe("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
});

it('keeps the rest of the configuration', () => {
  expect(config.output).toBe('standalone');
  expect(config.turbopack?.resolveAlias).toEqual({
    'plotly.js/dist/plotly': 'plotly.js-dist-min',
  });
  expect(typeof config.webpack).toBe('function');
});
