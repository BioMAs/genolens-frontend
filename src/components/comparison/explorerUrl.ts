/**
 * The Explorer screen's URL contract.
 *
 * Kept free of React, like `comparisonModules.ts`, so the codec can be unit-tested on its own —
 * URL round-tripping is exactly the kind of logic that rots silently inside a component.
 *
 * Two things earn a place in the URL: the thresholds, because "this comparison at padj < 0.01"
 * is a genuinely shareable statement, and **one** focused gene, because "look at TP53 in this
 * comparison" is the single most valuable link the screen can produce. Both must survive a cold
 * deep link and render the same screen as a warm one.
 *
 * A lasso of three hundred genes does **not** go in the URL. Length aside, it is not a stable
 * artifact worth a permalink; its shareable form is a **saved gene list**, which is durable and
 * permissioned — so a set that has been saved travels as `?geneList=<id>`, and an unsaved one
 * contributes only whichever gene the user picked out of it, if any.
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
export const PARAM_GENE = 'gene';
export const PARAM_GENE_LIST = 'geneList';

/**
 * Longest gene key accepted from a URL.
 *
 * Gene symbols run to a dozen characters and Ensembl accessions to about twenty; anything much
 * longer is a mangled link, not a gene, and should not reach a query as a filter value.
 */
const MAX_GENE_KEY_LENGTH = 64;

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

/**
 * Read the focused gene a URL asks for, or null when it names none.
 *
 * The value is returned **as written**, not upper-cased: normalising here would display a mouse
 * gene `Sox9` as `SOX9`. Matching it against a dataset is `geneKeys`' job.
 *
 * Anything implausible is rejected rather than passed along — an over-long value or one carrying
 * whitespace or separators is a mangled link, and a bad gene key would otherwise travel into
 * lookups and into the card's heading.
 */
export function readFocusedGene(params: URLSearchParams | null | undefined): string | null {
  const raw = params?.get(PARAM_GENE);
  if (!raw) return null;

  const gene = raw.trim();
  if (!gene || gene.length > MAX_GENE_KEY_LENGTH) return null;
  // Gene keys are word characters plus the few separators real symbols use (HLA-DRB1, MT-CO1).
  if (!/^[A-Za-z0-9_.:-]+$/.test(gene)) return null;

  return gene;
}

/**
 * Apply the shareable state — thresholds plus the focused gene — to a copy of `params`.
 *
 * Returns a new `URLSearchParams`; the input is never mutated, so a caller can compare the
 * serialised result against the current URL and skip a history write that changes nothing.
 */
export function writeExplorerState(
  params: URLSearchParams | null | undefined,
  thresholds: VolcanoThresholds,
  focusedGene: string | null | undefined,
  geneListId?: string | null
): URLSearchParams {
  const next = writeThresholds(params, thresholds);

  const gene = focusedGene?.trim();
  if (gene) {
    next.set(PARAM_GENE, gene);
  } else {
    next.delete(PARAM_GENE);
  }

  const listId = geneListId?.trim();
  if (listId) {
    next.set(PARAM_GENE_LIST, listId);
  } else {
    next.delete(PARAM_GENE_LIST);
  }

  return next;
}

/** True when writing this state would leave the query string byte-identical. */
export function urlMatchesState(
  params: URLSearchParams | null | undefined,
  thresholds: VolcanoThresholds,
  focusedGene: string | null | undefined,
  geneListId?: string | null
): boolean {
  const current = new URLSearchParams(params ?? undefined);
  return (
    writeExplorerState(current, thresholds, focusedGene, geneListId).toString() ===
    current.toString()
  );
}

/**
 * Read the saved gene list a URL points at, or null.
 *
 * Ids are UUIDs; anything else is a mangled link and is refused rather than sent to the API as
 * a path segment.
 */
export function readGeneListId(params: URLSearchParams | null | undefined): string | null {
  const raw = params?.get(PARAM_GENE_LIST)?.trim();
  if (!raw) return null;
  return /^[0-9a-fA-F-]{8,64}$/.test(raw) ? raw : null;
}
