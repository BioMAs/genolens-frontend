/**
 * The Explorer screen's URL contract.
 *
 * Kept free of React, like `comparisonModules.ts`, so the codec can be unit-tested on its own —
 * URL round-tripping is exactly the kind of logic that rots silently inside a component.
 *
 * Only the thresholds live here for now. They earn a place in the URL because "this comparison
 * at padj < 0.01" is a genuinely shareable statement, and because a cold deep link must render
 * the same screen as a warm one. A lasso of 300 genes does not go in the URL — its shareable
 * form is a saved gene list.
 *
 * Defaults are omitted on write, mirroring how `selectTab` already deletes `tab` for the default
 * view: a URL only ever names what departs from the default.
 */

import {
  clampThresholds,
  DEFAULT_THRESHOLDS,
  isDefaultThresholds,
  type VolcanoThresholds,
} from '@/utils/volcano';

export const PARAM_PADJ = 'padj';
export const PARAM_LOGFC = 'lfc';

/**
 * Read the thresholds a URL asks for, falling back to the defaults for anything unusable.
 *
 * Deliberately forgiving rather than strict: a hand-edited or truncated URL should land on a
 * working screen, never a blank one. Values are put through `clampThresholds`, so a URL cannot
 * request a looser threshold than ingestion honoured — the same guard the on-screen control has.
 */
export function readThresholds(params: URLSearchParams | null | undefined): VolcanoThresholds {
  if (!params) return DEFAULT_THRESHOLDS;

  return clampThresholds({
    padj: parseNumeric(params.get(PARAM_PADJ)),
    logfc: parseNumeric(params.get(PARAM_LOGFC)),
  });
}

/**
 * Apply thresholds to a copy of `params`, deleting each one that sits at its default.
 *
 * Returns a new `URLSearchParams`; the input is never mutated, so callers can compare the
 * serialised result against the current URL and skip a no-op history write.
 */
export function writeThresholds(
  params: URLSearchParams | null | undefined,
  thresholds: VolcanoThresholds
): URLSearchParams {
  const next = new URLSearchParams(params ?? undefined);
  const clamped = clampThresholds(thresholds);

  applyParam(next, PARAM_PADJ, clamped.padj, DEFAULT_THRESHOLDS.padj);
  applyParam(next, PARAM_LOGFC, clamped.logfc, DEFAULT_THRESHOLDS.logfc);

  return next;
}

/**
 * True when writing `thresholds` would leave the query string unchanged.
 *
 * Guards the history write: without it, every keystroke that resolves to the same value pushes
 * another `replaceState` and re-runs every `useSearchParams` consumer on the page.
 */
export function thresholdsMatchUrl(
  params: URLSearchParams | null | undefined,
  thresholds: VolcanoThresholds
): boolean {
  const current = new URLSearchParams(params ?? undefined);
  return writeThresholds(current, thresholds).toString() === current.toString();
}

/** Whether these thresholds would appear in the URL at all. */
export function thresholdsAreImplicit(thresholds: VolcanoThresholds): boolean {
  return isDefaultThresholds(clampThresholds(thresholds));
}

function parseNumeric(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function applyParam(
  params: URLSearchParams,
  key: string,
  value: number,
  fallback: number
): void {
  if (value === fallback) {
    params.delete(key);
    return;
  }
  // Number#toString drops trailing zeros, so 0.010 and 0.01 produce the same URL — which keeps
  // `thresholdsMatchUrl` from seeing a difference that does not exist.
  params.set(key, String(value));
}
