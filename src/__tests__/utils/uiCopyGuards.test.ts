import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SUPPORT_EMAIL } from '@/lib/contact';

/**
 * Source-level guards for copy that drifted before: retired plan names, a price
 * that was never on the grid, the 402 "quota reached" branch the backend never
 * returns, and a second support mailbox. Comments are stripped first, so notes
 * that explain the history do not trip the guard.
 */
const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
  .map((f) => join('src', f))
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__'));

const read = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const offenders = (pattern: RegExp) => SOURCES.filter((f) => pattern.test(read(f)));

describe('UI copy guards', () => {
  it('names no retired plan in gate copy', () => {
    expect(offenders(/PREMIUM or ADVANCED|Pro or Advanced|Advanced plan/)).toEqual([]);
  });

  it('shows no hard-coded plan price', () => {
    expect(offenders(/Starting at \$\d/)).toEqual([]);
  });

  it('has no branch on a 402 the backend never returns', () => {
    expect(offenders(/status === 402/)).toEqual([]);
  });

  it('uses a single support address, from lib/contact', () => {
    expect(SUPPORT_EMAIL).toBe('support@scilicium.com');
    const hardCoded = SOURCES.filter(
      (f) => !f.endsWith(join('lib', 'contact.ts')) && /support@[a-z]+\.com/.test(read(f)),
    );
    expect(hardCoded).toEqual([]);
  });
});
