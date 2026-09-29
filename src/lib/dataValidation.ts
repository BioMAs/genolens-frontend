/**
 * Checks behind the wizard's "Data Validation & QC" step.
 *
 * Per-sample metrics come from the count matrix's dataset_metadata (written at
 * upload by the backend's compute_count_matrix_qc); cross-file checks compare the
 * matrix's sample columns with the sample-sheet rows. Everything mirrors what
 * run_multimethod_pipeline.R does with the same files, so a warning here means
 * the pipeline will drop, skip or fail on something.
 */

// Wizard defaults for the pipeline's per-sample QC filter (StepAnalysisSettings).
export const MIN_READS_PER_SAMPLE = 100_000;
export const MIN_DETECTED_GENES_PER_SAMPLE = 500;
export const MIN_TOTAL_SAMPLES = 4;
export const MIN_SAMPLES_PER_CONDITION = 2;

// Same aliases, same order, as run_multimethod_pipeline.R (matched on lower-cased headers).
export const SAMPLE_ID_ALIASES = ['sample_id', 'sample', 'sampleid', 'id'];
export const CONDITION_ALIASES = ['condition', 'group', 'treatment', 'genotype'];

export interface ValidationIssue {
  id: string;
  title: string;
  detail: string;
  /** Blocking issues disable "Continue": the analysis cannot run at all. */
  blocking: boolean;
}

export interface ValidationReport {
  issues: ValidationIssue[];
  blocking: boolean;
  /** False when some checks could not run (missing metrics or sample sheet). */
  complete: boolean;
  /** The matrix predates the per-sample QC metrics (re-upload to compute them). */
  matrixMetricsMissing: boolean;
}

interface MatrixQC {
  nSamples?: number;
  sampleNames?: string[];
  libSizes?: Record<string, number>;
  detectedGenes?: Record<string, number>;
  minLibSize?: number;
  minDetectedGenes?: number;
}

type Row = Record<string, unknown>;

export interface ValidationInput {
  matrixMetadata?: Record<string, unknown>;
  /** Sample-sheet rows, or undefined while not loaded. */
  sampleRows?: Row[];
  /** Sample-sheet header, in file order. */
  sampleColumns?: string[];
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const record = (v: unknown) =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, number>) : undefined;

function readMatrixQC(meta: Record<string, unknown> | undefined): MatrixQC {
  if (!meta) return {};
  return {
    nSamples: num(meta.n_samples) ?? num(meta.num_samples),
    sampleNames: Array.isArray(meta.sample_names) ? meta.sample_names.map(String) : undefined,
    libSizes: record(meta.lib_sizes),
    detectedGenes: record(meta.detected_genes),
    minLibSize: num(meta.min_lib_size),
    minDetectedGenes: num(meta.min_detected_genes),
  };
}

/** The first alias present in the header (case-insensitive), as R picks it. */
export function findAliasColumn(columns: string[], aliases: string[]): string | undefined {
  for (const alias of aliases) {
    const hit = columns.find(c => c.trim().toLowerCase() === alias);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** "A, B, C and 4 more" */
export function listSamples(names: string[], max = 5): string {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

function lowSampleIssue(
  id: string,
  perSample: Record<string, number> | undefined,
  min: number | undefined,
  threshold: number,
  what: string,
  setting: string,
): ValidationIssue | null {
  if (perSample) {
    const low = Object.entries(perSample).filter(([, v]) => v < threshold);
    if (low.length === 0) return null;
    const names = low.map(([s, v]) => `${s} (${fmt(v)})`);
    return {
      id,
      title: `${low.length} ${plural(low.length, 'sample')} with fewer than ${fmt(threshold)} ${what}`,
      detail:
        `${listSamples(names)}. With the default settings the pipeline removes ` +
        `${plural(low.length, 'this sample', 'these samples')} before the analysis. ` +
        `Check the library, or lower "${setting}" (Advanced mode) in the next step if this depth is expected.`,
      blocking: false,
    };
  }
  if (min !== undefined && min < threshold) {
    return {
      id,
      title: `At least one sample has fewer than ${fmt(threshold)} ${what}`,
      detail:
        `Lowest value: ${fmt(min)}. With the default settings the pipeline removes such samples ` +
        `before the analysis. Check the library, or lower "${setting}" (Advanced mode) in the next step.`,
      blocking: false,
    };
  }
  return null;
}

export function buildValidationReport({
  matrixMetadata,
  sampleRows,
  sampleColumns,
}: ValidationInput): ValidationReport {
  const qc = readMatrixQC(matrixMetadata);
  const issues: ValidationIssue[] = [];
  let complete = true;

  // ── Count matrix on its own ────────────────────────────────────────────────
  const matrixMetricsMissing = qc.libSizes === undefined && qc.minLibSize === undefined;
  if (matrixMetricsMissing) complete = false;

  const lowReads = lowSampleIssue(
    'low-reads', qc.libSizes, qc.minLibSize, MIN_READS_PER_SAMPLE, 'reads', 'Min reads / sample',
  );
  if (lowReads) issues.push(lowReads);

  const lowGenes = lowSampleIssue(
    'low-genes', qc.detectedGenes, qc.minDetectedGenes, MIN_DETECTED_GENES_PER_SAMPLE,
    'detected genes', 'Min genes / sample',
  );
  if (lowGenes) issues.push(lowGenes);

  const nSamples = qc.nSamples ?? qc.sampleNames?.length;
  if (nSamples === undefined) complete = false;
  else if (nSamples < MIN_TOTAL_SAMPLES) {
    issues.push({
      id: 'few-samples',
      title: `Only ${nSamples} ${plural(nSamples, 'sample')} in the count matrix`,
      detail:
        `Each condition needs at least ${MIN_SAMPLES_PER_CONDITION} replicates, so one comparison ` +
        `needs at least ${MIN_TOTAL_SAMPLES} samples. Add replicates if you can; results from so ` +
        `few samples have very little statistical power.`,
      blocking: false,
    });
  }

  // ── Count matrix × sample sheet ────────────────────────────────────────────
  if (!sampleRows || !sampleColumns) {
    return { issues, blocking: false, complete: false, matrixMetricsMissing };
  }

  const sidCol = findAliasColumn(sampleColumns, SAMPLE_ID_ALIASES);
  const condCol = findAliasColumn(sampleColumns, CONDITION_ALIASES);
  const header = sampleColumns.length ? `Columns found: ${sampleColumns.join(', ')}.` : '';

  if (!sidCol) {
    issues.push({
      id: 'no-sample-id-column',
      title: 'No sample ID column in the sample sheet',
      detail:
        `The pipeline looks for a column named sample_id, sample, sampleid or id (any case) ` +
        `and stops without one. ${header} Rename the column holding the sample names and ` +
        `upload the sheet again.`,
      blocking: false,
    });
  }
  if (!condCol) {
    issues.push({
      id: 'no-condition-column',
      title: 'No condition column in the sample sheet',
      detail:
        `The pipeline looks for a column named condition, group, treatment or genotype ` +
        `(any case) and stops without one. ${header} Rename the column holding the ` +
        `experimental groups and upload the sheet again.`,
      blocking: false,
    });
  }

  const matrixSamples = qc.sampleNames;
  const sheetSamples = sidCol
    ? sampleRows
        .map(r => r[sidCol])
        .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
        .map(v => String(v).trim())
    : undefined;

  if (!matrixSamples || !sheetSamples) complete = false;

  let sharedSamples: Set<string> | undefined;
  if (matrixSamples && sheetSamples) {
    const inSheet = new Set(sheetSamples);
    const inMatrix = new Set(matrixSamples);
    const matrixOnly = matrixSamples.filter(s => !inSheet.has(s));
    const sheetOnly = [...inSheet].filter(s => !inMatrix.has(s));
    sharedSamples = new Set(matrixSamples.filter(s => inSheet.has(s)));

    if (sharedSamples.size === 0 && matrixSamples.length > 0 && inSheet.size > 0) {
      issues.push({
        id: 'no-shared-samples',
        title: 'No sample in the count matrix matches the sample sheet',
        detail:
          `Matrix columns: ${listSamples(matrixSamples)}. Sample sheet "${sidCol}" values: ` +
          `${listSamples([...inSheet])}. Names must match exactly (case included). Fix one of ` +
          `the two files and upload it again — the analysis cannot run until they match.`,
        blocking: true,
      });
    } else {
      if (matrixOnly.length > 0) {
        issues.push({
          id: 'matrix-samples-missing-from-sheet',
          title: `${matrixOnly.length} matrix ${plural(matrixOnly.length, 'column is', 'columns are')} not in the sample sheet`,
          detail:
            `${listSamples(matrixOnly)}. The pipeline ignores samples it has no condition for. ` +
            `Add ${plural(matrixOnly.length, 'it', 'them')} to the sample sheet, or check the spelling ` +
            `(names must match exactly, case included).`,
          blocking: false,
        });
      }
      if (sheetOnly.length > 0) {
        issues.push({
          id: 'sheet-samples-missing-from-matrix',
          title: `${sheetOnly.length} sample-sheet ${plural(sheetOnly.length, 'entry has', 'entries have')} no column in the count matrix`,
          detail:
            `${listSamples(sheetOnly)}. ${plural(sheetOnly.length, 'This sample', 'These samples')} ` +
            `will be left out of the analysis. Check the spelling or remove ` +
            `${plural(sheetOnly.length, 'it', 'them')} from the sample sheet.`,
          blocking: false,
        });
      }
    }
  }

  // Conditions are counted over the samples the pipeline will actually use.
  if (condCol) {
    const counts = new Map<string, number>();
    for (const row of sampleRows) {
      const cond = row[condCol];
      if (cond === null || cond === undefined || String(cond).trim() === '') continue;
      if (sidCol && sharedSamples && !sharedSamples.has(String(row[sidCol] ?? '').trim())) continue;
      const key = String(cond).trim();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const small = [...counts].filter(([, n]) => n < MIN_SAMPLES_PER_CONDITION);
    if (small.length > 0) {
      issues.push({
        id: 'small-conditions',
        title: `${small.length} ${plural(small.length, 'condition has', 'conditions have')} fewer than ${MIN_SAMPLES_PER_CONDITION} samples`,
        detail:
          `${listSamples(small.map(([c, n]) => `${c} (${n})`))}. The pipeline skips any ` +
          `comparison involving ${plural(small.length, 'this condition', 'these conditions')}. ` +
          `Add replicates, or merge ${plural(small.length, 'it', 'them')} with another group in ` +
          `the "${condCol}" column.`,
        blocking: false,
      });
    }
  }

  return { issues, blocking: issues.some(i => i.blocking), complete, matrixMetricsMissing };
}
