/**
 * Checks behind the wizard's "Data Validation & QC" step.
 *
 * Until the backend stored per-sample metrics, the step read metadata keys no
 * upload ever wrote, so every dataset got "All checks passed". Each test below
 * pins one warning to the pipeline behaviour it anticipates.
 */
import {
  buildValidationReport,
  findAliasColumn,
  listSamples,
  ValidationInput,
} from '@/lib/dataValidation';

const SAMPLES = ['S1', 'S2', 'S3', 'S4'];

/** A clean 4-sample matrix: deep libraries, many detected genes. */
function matrix(overrides: Record<string, unknown> = {}) {
  return {
    n_genes: 20000,
    n_samples: 4,
    sample_names: SAMPLES,
    lib_sizes: { S1: 2e7, S2: 2.1e7, S3: 1.9e7, S4: 2.2e7 },
    detected_genes: { S1: 15000, S2: 15100, S3: 14900, S4: 15200 },
    min_lib_size: 1.9e7,
    min_detected_genes: 14900,
    ...overrides,
  };
}

function sheet(rows: [string, string][], columns = ['sample_id', 'condition']) {
  return {
    sampleColumns: columns,
    sampleRows: rows.map(([s, c]) => ({ [columns[0]]: s, [columns[1]]: c })),
  };
}

const CLEAN_ROWS: [string, string][] = [['S1', 'ctrl'], ['S2', 'ctrl'], ['S3', 'trt'], ['S4', 'trt']];

function report(input: Partial<ValidationInput> = {}) {
  return buildValidationReport({ matrixMetadata: matrix(), ...sheet(CLEAN_ROWS), ...input });
}

const ids = (input: Partial<ValidationInput> = {}) => report(input).issues.map(i => i.id);

describe('passing state', () => {
  it('reports nothing, completely, for clean files', () => {
    expect(report()).toEqual({ issues: [], blocking: false, complete: true, matrixMetricsMissing: false });
  });

  it('is incomplete when the matrix has no per-sample metrics (uploaded before the fix)', () => {
    const r = report({ matrixMetadata: { rows: 100, columns: 5 } });
    expect(r.issues).toEqual([]);
    expect(r.complete).toBe(false);
    expect(r.matrixMetricsMissing).toBe(true);
  });

  it('is incomplete while the sample sheet is not loaded', () => {
    const r = report({ sampleRows: undefined, sampleColumns: undefined });
    expect(r.issues).toEqual([]);
    expect(r.complete).toBe(false);
  });
});

describe('low reads per sample', () => {
  it('names each sample under 100,000 reads with its count', () => {
    const r = report({
      matrixMetadata: matrix({ lib_sizes: { S1: 2e7, S2: 85000, S3: 1.9e7, S4: 99999 } }),
    });
    const issue = r.issues.find(i => i.id === 'low-reads')!;
    expect(issue.title).toBe('2 samples with fewer than 100,000 reads');
    expect(issue.detail).toContain('S2 (85,000), S4 (99,999)');
    expect(issue.detail).toContain('"Min reads / sample" (Advanced mode)');
    expect(issue.blocking).toBe(false);
  });

  it('does not flag exactly 100,000 reads (the filter keeps >=)', () => {
    expect(ids({ matrixMetadata: matrix({ lib_sizes: { S1: 100000 } }) })).not.toContain('low-reads');
  });

  it('falls back to min_lib_size when the per-sample map is absent', () => {
    const meta = matrix({ lib_sizes: undefined, min_lib_size: 5000 });
    const issue = report({ matrixMetadata: meta }).issues.find(i => i.id === 'low-reads')!;
    expect(issue.detail).toContain('5,000');
  });
});

describe('low detected genes per sample', () => {
  it('names each sample with fewer than 500 detected genes', () => {
    const r = report({
      matrixMetadata: matrix({ detected_genes: { S1: 15000, S2: 120, S3: 14900, S4: 15200 } }),
    });
    const issue = r.issues.find(i => i.id === 'low-genes')!;
    expect(issue.title).toBe('1 sample with fewer than 500 detected genes');
    expect(issue.detail).toContain('S2 (120)');
    expect(issue.detail).toContain('this sample');
  });
});

describe('too few samples', () => {
  it('warns under 4 samples', () => {
    const r = report({
      matrixMetadata: matrix({ n_samples: 3, sample_names: ['S1', 'S2', 'S3'] }),
      ...sheet([['S1', 'ctrl'], ['S2', 'ctrl'], ['S3', 'trt']]),
    });
    const issue = r.issues.find(i => i.id === 'few-samples')!;
    expect(issue.title).toBe('Only 3 samples in the count matrix');
    expect(issue.blocking).toBe(false);
  });

  it('does not warn at 4 samples', () => {
    expect(ids()).not.toContain('few-samples');
  });
});

describe('sample sheet columns', () => {
  it('recognises the R aliases case-insensitively', () => {
    const r = report(sheet(CLEAN_ROWS, ['SampleID', 'Treatment']));
    expect(r.issues).toEqual([]);
  });

  it('warns when no sample-ID column is recognised, listing the columns found', () => {
    const r = report(sheet(CLEAN_ROWS, ['label', 'condition']));
    const issue = r.issues.find(i => i.id === 'no-sample-id-column')!;
    expect(issue.detail).toContain('Columns found: label, condition.');
    expect(issue.blocking).toBe(false);
    expect(r.complete).toBe(false); // the mismatch check could not run
  });

  it('warns when no condition column is recognised (uploaded contrast file)', () => {
    const r = report(sheet(CLEAN_ROWS, ['sample', 'cohort']));
    expect(r.issues.map(i => i.id)).toEqual(['no-condition-column']);
  });

  it('recognises "groupe" and "name", like the pipeline', () => {
    expect(report(sheet(CLEAN_ROWS, ['name', 'groupe'])).issues).toEqual([]);
  });

  it('checks the column picked in the builder instead of guessing one', () => {
    // No alias column: fine, because R receives the picked column at launch.
    const r = report({ ...sheet(CLEAN_ROWS, ['sample', 'Cohort']), conditionColumn: 'cohort' });
    expect(r.issues).toEqual([]);
  });

  it('counts replicates on the picked column, not on an alias column', () => {
    const rows = CLEAN_ROWS.map(([s, c], i) => ({ sample: s, condition: c, cohort: i === 0 ? 'a' : 'b' }));
    const r = report({ sampleColumns: ['sample', 'condition', 'cohort'], sampleRows: rows, conditionColumn: 'cohort' });
    const issue = r.issues.find(i => i.id === 'small-conditions')!;
    expect(issue.detail).toContain('a (1)');
    expect(issue.detail).toContain('"cohort" column');
  });

  it('warns when the picked column is no longer in the sample sheet', () => {
    const r = report({ ...sheet(CLEAN_ROWS, ['sample', 'condition']), conditionColumn: 'cohort' });
    expect(r.issues.map(i => i.id)).toEqual(['condition-column-missing']);
    expect(r.issues[0].detail).toContain('Columns found: sample, condition.');
  });

  it('picks the first alias in pipeline order', () => {
    expect(findAliasColumn(['ID', 'Sample'], ['sample_id', 'sample', 'sampleid', 'id'])).toBe('Sample');
  });
});

describe('matrix vs sample sheet', () => {
  it('lists matrix columns missing from the sample sheet', () => {
    const r = report(sheet([['S1', 'ctrl'], ['S2', 'ctrl'], ['S3', 'trt']]));
    const issue = r.issues.find(i => i.id === 'matrix-samples-missing-from-sheet')!;
    expect(issue.title).toBe('1 matrix column is not in the sample sheet');
    expect(issue.detail).toMatch(/^S4\./);
    expect(r.blocking).toBe(false);
  });

  it('lists sample-sheet entries missing from the matrix', () => {
    const r = report(sheet([...CLEAN_ROWS, ['S5', 'trt'], ['s1', 'ctrl']]));
    const issue = r.issues.find(i => i.id === 'sheet-samples-missing-from-matrix')!;
    expect(issue.title).toBe('2 sample-sheet entries have no column in the count matrix');
    expect(issue.detail).toContain('S5, s1'); // matching is case-sensitive, as in R
  });

  it('blocks when no sample matches at all', () => {
    const r = report(sheet([['A', 'ctrl'], ['B', 'ctrl'], ['C', 'trt'], ['D', 'trt']]));
    expect(r.blocking).toBe(true);
    expect(r.issues.map(i => i.id)).toEqual(['no-shared-samples']);
    expect(r.issues[0].detail).toContain('Matrix columns: S1, S2, S3, S4');
  });

  it('ignores surrounding whitespace in sample IDs', () => {
    expect(report(sheet([[' S1', 'ctrl'], ['S2 ', 'ctrl'], ['S3', 'trt'], ['S4', 'trt']])).issues).toEqual([]);
  });
});

describe('conditions with fewer than 2 samples', () => {
  it('names each condition with its sample count', () => {
    const r = report(sheet([['S1', 'ctrl'], ['S2', 'ctrl'], ['S3', 'trt'], ['S4', 'ko']]));
    const issue = r.issues.find(i => i.id === 'small-conditions')!;
    expect(issue.title).toBe('2 conditions have fewer than 2 samples');
    expect(issue.detail).toContain('trt (1), ko (1)');
    expect(issue.detail).toContain('"condition" column');
  });

  it('only counts samples present in the matrix', () => {
    // S5 has no matrix column, so "trt" really has one usable sample.
    const r = report(sheet([['S1', 'ctrl'], ['S2', 'ctrl'], ['S3', 'ctrl'], ['S4', 'trt'], ['S5', 'trt']]));
    expect(r.issues.find(i => i.id === 'small-conditions')?.detail).toContain('trt (1)');
  });
});

it('truncates long sample lists', () => {
  expect(listSamples(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toBe('a, b, c, d, e and 2 more');
});
