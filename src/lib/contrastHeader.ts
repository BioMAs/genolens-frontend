/**
 * Client-side check of an uploaded contrast file's header.
 *
 * The R pipeline (backend/r_scripts/run_multimethod_pipeline.R) lower-cases the
 * header and looks for one column of each kind below, stopping with an error when
 * any is missing. Keep these alias lists in sync with that script.
 */

export type ContrastColumnKind = 'name' | 'test' | 'reference';

export const CONTRAST_COLUMN_ALIASES: Record<ContrastColumnKind, readonly string[]> = {
  name: ['comparison', 'comparison_id', 'comparison_name', 'name', 'contrast'],
  test: ['condition1', 'test', 'numerator', 'group1'],
  reference: ['condition2', 'ref', 'denominator', 'group2'],
};

const KIND_LABEL: Record<ContrastColumnKind, string> = {
  name: 'comparison name column (e.g. "comparison")',
  test: 'test condition column (e.g. "condition1")',
  reference: 'reference condition column (e.g. "condition2")',
};

/** Splits a header line on its most likely delimiter (tab, then comma, then semicolon). */
export function splitHeader(line: string): string[] {
  const clean = line.replace(/^﻿/, '').replace(/\r$/, '');
  const delimiter = ['\t', ',', ';'].find((d) => clean.includes(d));
  const cells = delimiter ? clean.split(delimiter) : [clean];
  return cells.map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim().toLowerCase());
}

/** Returns the column kinds the header lacks, in pipeline order. Empty = header is fine. */
export function missingContrastColumns(headerLine: string): ContrastColumnKind[] {
  const cols = new Set(splitHeader(headerLine));
  return (Object.keys(CONTRAST_COLUMN_ALIASES) as ContrastColumnKind[]).filter(
    (kind) => !CONTRAST_COLUMN_ALIASES[kind].some((alias) => cols.has(alias)),
  );
}

/** User-facing warning for a header, or null when every column kind is present. */
export function contrastHeaderWarning(headerLine: string): string | null {
  const missing = missingContrastColumns(headerLine);
  if (missing.length === 0) return null;
  const list = missing.map((k) => KIND_LABEL[k]).join(', ');
  return (
    `This contrast file is missing: ${list}. The analysis will stop with an error. ` +
    'Use the columns comparison, condition1 (test) and condition2 (reference).'
  );
}

const TEXT_EXT = ['.csv', '.tsv', '.txt'];

/**
 * Reads the first non-empty line of a text contrast file and returns a warning, or null.
 * Excel files are not parsed client-side and always return null.
 */
export async function checkContrastFile(file: File): Promise<string | null> {
  const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`;
  if (!TEXT_EXT.includes(ext)) return null;
  const head = await readText(file.slice(0, 64 * 1024));
  const firstLine = head.split('\n').find((l) => l.trim() !== '') ?? '';
  return contrastHeaderWarning(firstLine);
}

function readText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}
