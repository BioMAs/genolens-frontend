/**
 * Volcano significance, derived on the client.
 *
 * `GET /datasets/{id}/volcano-plot/{comparison}` does **not** filter its point cloud by the
 * thresholds it is given. On the cached path (`datasets.py:2014-2044`) it walks the stored cloud
 * and returns every point, recomputing only the `is_significant` flag. On the cold Parquet path
 * (`:2124-2136`) it always keeps every significant point and merely downsamples the
 * non-significant ones to fill `max_points`.
 *
 * Two consequences the Explorer screen is built on:
 *
 * 1. **A threshold change needs no refetch.** Fetch the cloud once at the ingestion defaults and
 *    recompute significance here. That is why `useVolcanoPoints` keeps thresholds out of its
 *    React Query key.
 * 2. **This is sound on both paths only because thresholds can only tighten.** `deg_genes` is
 *    populated at ingestion with `DEG_PADJ_THRESHOLD = 0.05` / `DEG_LOGFC_THRESHOLD = 0.58`
 *    (`data_processor.py:26-27`), so the UI clamps to those bounds. Tightening only ever narrows
 *    a set already present in the cloud; loosening would ask for points the cold path may have
 *    downsampled away, and rows the table could never have.
 *
 * The comparisons below must stay **byte-identical** to the server's, or the synthesis strip will
 * contradict the plot at the boundary: the server uses `padj < threshold` and
 * `abs(logFC) > threshold`, both strict.
 */

/** Adjusted p-value ceiling applied when DEG rows were ingested (`data_processor.py:27`). */
export const INGESTION_PADJ_MAX = 0.05;

/** Absolute log2 fold-change floor applied when DEG rows were ingested (`data_processor.py:26`). */
export const INGESTION_LOGFC_MIN = 0.58;

/**
 * Value the backend substitutes when a dataset has no recognisable gene column
 * (`datasets.py:2030` and `:2147`). It is a sentinel, not a gene — never select on it.
 */
export const UNKNOWN_GENE = 'Unknown';

/** One point as the volcano endpoint returns it. `x` is log2FC, `y` is -log10(padj). */
export interface VolcanoPoint {
  gene: string;
  x: number;
  y: number;
  padj: number;
  /** Server's verdict at the thresholds it was called with — recomputed here instead. */
  is_significant: boolean;
}

/** The page-wide thresholds. `logfc` is compared against `|x|`. */
export interface VolcanoThresholds {
  padj: number;
  logfc: number;
}

export const DEFAULT_THRESHOLDS: VolcanoThresholds = {
  padj: INGESTION_PADJ_MAX,
  logfc: INGESTION_LOGFC_MIN,
};

/**
 * Confine thresholds to what the data can honour, and reject nonsense.
 *
 * The bounds are the ingestion thresholds: a looser value would show a volcano the DEG table
 * cannot follow. A non-finite input falls back to the default rather than poisoning every
 * downstream comparison with `NaN`.
 */
export function clampThresholds(input: Partial<VolcanoThresholds>): VolcanoThresholds {
  const padj = Number.isFinite(input.padj) ? (input.padj as number) : DEFAULT_THRESHOLDS.padj;
  const logfc = Number.isFinite(input.logfc) ? (input.logfc as number) : DEFAULT_THRESHOLDS.logfc;
  return {
    // upper bound: cannot be looser than ingestion. lower bound: keep it a usable p-value.
    padj: Math.min(Math.max(padj, Number.MIN_VALUE), INGESTION_PADJ_MAX),
    logfc: Math.max(logfc, INGESTION_LOGFC_MIN),
  };
}

/** True when the thresholds sit exactly on the ingestion bounds — nothing has been tightened. */
export function isDefaultThresholds(t: VolcanoThresholds): boolean {
  return t.padj === DEFAULT_THRESHOLDS.padj && t.logfc === DEFAULT_THRESHOLDS.logfc;
}

/**
 * Significance of one point, using the server's exact operators.
 *
 * A point with a non-finite `padj` or `x` is never significant, mirroring the server's
 * `notna()` filter (`datasets.py:2117`).
 */
export function isSignificant(point: VolcanoPoint, t: VolcanoThresholds): boolean {
  if (!Number.isFinite(point.padj) || !Number.isFinite(point.x)) return false;
  return point.padj < t.padj && Math.abs(point.x) > t.logfc;
}

export interface SignificanceSummary {
  /** Significant and over-expressed (`x > 0`). */
  up: number;
  /** Significant and under-expressed (`x < 0`). */
  down: number;
  /** Not significant at these thresholds. */
  ns: number;
  /** `up + down`. */
  significant: number;
  /** Points in the cloud — see the caveat on `total_genes` below. */
  total: number;
}

/**
 * Count up / down / not-significant across the cloud at the given thresholds.
 *
 * Prefer this over the response's `significant_genes`, and never surface its `total_genes` as
 * "genes tested": the two server paths disagree on what that field means — `len(points)` on the
 * cached path (`datasets.py:2039`, i.e. points returned) versus `len(df_valid)` on the cold path
 * (`:2159`, i.e. genes actually tested).
 *
 * A point sitting exactly on a threshold counts as **not** significant, because both server
 * comparisons are strict.
 */
export function deriveSignificance(
  points: readonly VolcanoPoint[],
  thresholds: VolcanoThresholds
): SignificanceSummary {
  let up = 0;
  let down = 0;
  let ns = 0;

  for (const point of points) {
    if (!isSignificant(point, thresholds)) {
      ns += 1;
    } else if (point.x > 0) {
      up += 1;
    } else if (point.x < 0) {
      down += 1;
    } else {
      // |x| > logfc yet x === 0 is unreachable for any non-negative threshold; count it as
      // non-significant rather than silently dropping it from the totals.
      ns += 1;
    }
  }

  return { up, down, ns, significant: up + down, total: points.length };
}

/**
 * Genes of the significant points, in cloud order, skipping the `Unknown` sentinel.
 *
 * Keys are returned raw — normalise through `geneKeys` before matching them against DEG rows.
 */
export function significantGenes(
  points: readonly VolcanoPoint[],
  thresholds: VolcanoThresholds
): string[] {
  const out: string[] = [];
  for (const point of points) {
    if (point.gene && point.gene !== UNKNOWN_GENE && isSignificant(point, thresholds)) {
      out.push(point.gene);
    }
  }
  return out;
}
