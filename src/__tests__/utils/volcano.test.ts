import {
  clampThresholds,
  DEFAULT_THRESHOLDS,
  deriveSignificance,
  INGESTION_LOGFC_MIN,
  INGESTION_PADJ_MAX,
  isDefaultThresholds,
  isSignificant,
  significantGenes,
  UNKNOWN_GENE,
  type VolcanoPoint,
} from '@/utils/volcano';

const point = (over: Partial<VolcanoPoint> = {}): VolcanoPoint => ({
  gene: 'TP53',
  x: 2,
  y: 8,
  padj: 1e-8,
  is_significant: true,
  ...over,
});

describe('ingestion constants', () => {
  it('mirror data_processor.py, which is what deg_genes was populated with', () => {
    expect(INGESTION_PADJ_MAX).toBe(0.05);
    expect(INGESTION_LOGFC_MIN).toBe(0.58);
    expect(DEFAULT_THRESHOLDS).toEqual({ padj: 0.05, logfc: 0.58 });
  });
});

describe('isSignificant', () => {
  const t = DEFAULT_THRESHOLDS;

  it('accepts a point comfortably past both thresholds', () => {
    expect(isSignificant(point({ padj: 1e-6, x: 1.5 }), t)).toBe(true);
  });

  it('uses the absolute fold change, so down-regulation counts', () => {
    expect(isSignificant(point({ padj: 1e-6, x: -1.5 }), t)).toBe(true);
  });

  // These four are the whole point of the module: the server compares strictly, so a point
  // exactly on a threshold is NOT significant. Getting this wrong makes the synthesis strip
  // disagree with the plot at the boundary.
  it('excludes a padj exactly on the threshold (server uses <)', () => {
    expect(isSignificant(point({ padj: 0.05, x: 2 }), t)).toBe(false);
    expect(isSignificant(point({ padj: 0.049999, x: 2 }), t)).toBe(true);
  });

  it('excludes a |log2FC| exactly on the threshold (server uses >)', () => {
    expect(isSignificant(point({ padj: 1e-6, x: 0.58 }), t)).toBe(false);
    expect(isSignificant(point({ padj: 1e-6, x: -0.58 }), t)).toBe(false);
    expect(isSignificant(point({ padj: 1e-6, x: 0.580001 }), t)).toBe(true);
  });

  it('refuses non-finite values, mirroring the server notna() filter', () => {
    expect(isSignificant(point({ padj: NaN }), t)).toBe(false);
    expect(isSignificant(point({ x: NaN }), t)).toBe(false);
    expect(isSignificant(point({ x: Infinity, padj: 1e-9 }), t)).toBe(false);
  });

  it('ignores the server is_significant flag entirely', () => {
    // the server computed this at whatever thresholds it was called with; we recompute
    expect(isSignificant(point({ padj: 0.4, x: 0.1, is_significant: true }), t)).toBe(false);
    expect(isSignificant(point({ padj: 1e-9, x: 3, is_significant: false }), t)).toBe(true);
  });
});

describe('clampThresholds', () => {
  it('leaves a tightened pair untouched', () => {
    expect(clampThresholds({ padj: 0.001, logfc: 1.5 })).toEqual({ padj: 0.001, logfc: 1.5 });
  });

  it('refuses to loosen past what ingestion kept', () => {
    // deg_genes has no rows above padj 0.05, so a looser volcano would outrun the table
    expect(clampThresholds({ padj: 0.5, logfc: 0.2 })).toEqual({ padj: 0.05, logfc: 0.58 });
    expect(clampThresholds({ padj: 1, logfc: 0 })).toEqual({ padj: 0.05, logfc: 0.58 });
  });

  it('keeps padj a usable p-value when handed zero or a negative', () => {
    expect(clampThresholds({ padj: 0, logfc: 1 }).padj).toBeGreaterThan(0);
    expect(clampThresholds({ padj: -1, logfc: 1 }).padj).toBeGreaterThan(0);
  });

  it('falls back to the defaults for non-finite input instead of spreading NaN', () => {
    expect(clampThresholds({ padj: NaN, logfc: NaN })).toEqual(DEFAULT_THRESHOLDS);
    expect(clampThresholds({})).toEqual(DEFAULT_THRESHOLDS);
  });

  it('accepts an arbitrarily tight fold change', () => {
    expect(clampThresholds({ padj: 0.01, logfc: 100 }).logfc).toBe(100);
  });
});

describe('isDefaultThresholds', () => {
  it('is true only on the ingestion bounds, so the URL can omit them', () => {
    expect(isDefaultThresholds(DEFAULT_THRESHOLDS)).toBe(true);
    expect(isDefaultThresholds({ padj: 0.01, logfc: 0.58 })).toBe(false);
    expect(isDefaultThresholds({ padj: 0.05, logfc: 1 })).toBe(false);
  });
});

describe('deriveSignificance', () => {
  const cloud: VolcanoPoint[] = [
    point({ gene: 'UP1', x: 2, padj: 1e-9 }),
    point({ gene: 'UP2', x: 0.9, padj: 0.001 }),
    point({ gene: 'DOWN1', x: -3, padj: 1e-12 }),
    point({ gene: 'NS_PADJ', x: 4, padj: 0.2 }),
    point({ gene: 'NS_LFC', x: 0.1, padj: 1e-9 }),
    point({ gene: 'ON_BOUNDARY', x: 0.58, padj: 0.05 }),
  ];

  it('splits the cloud into up, down and not-significant', () => {
    expect(deriveSignificance(cloud, DEFAULT_THRESHOLDS)).toEqual({
      up: 2,
      down: 1,
      ns: 3,
      significant: 3,
      total: 6,
    });
  });

  it('narrows as the thresholds tighten, without refetching anything', () => {
    const tight = deriveSignificance(cloud, { padj: 1e-8, logfc: 1.5 });
    expect(tight).toEqual({ up: 1, down: 1, ns: 4, significant: 2, total: 6 });
    // the cloud never changed size — that is the design
    expect(tight.total).toBe(cloud.length);
  });

  it('counts a zero fold change as not significant', () => {
    const summary = deriveSignificance([point({ x: 0, padj: 1e-9 })], DEFAULT_THRESHOLDS);
    expect(summary).toEqual({ up: 0, down: 0, ns: 1, significant: 0, total: 1 });
  });

  it('handles an empty cloud', () => {
    expect(deriveSignificance([], DEFAULT_THRESHOLDS)).toEqual({
      up: 0,
      down: 0,
      ns: 0,
      significant: 0,
      total: 0,
    });
  });

  it('always accounts for every point', () => {
    const s = deriveSignificance(cloud, { padj: 0.03, logfc: 0.8 });
    expect(s.up + s.down + s.ns).toBe(s.total);
  });
});

describe('significantGenes', () => {
  it('returns the significant genes in cloud order', () => {
    const cloud = [
      point({ gene: 'DOWN1', x: -3, padj: 1e-9 }),
      point({ gene: 'NS', x: 0.1, padj: 0.5 }),
      point({ gene: 'UP1', x: 3, padj: 1e-9 }),
    ];
    expect(significantGenes(cloud, DEFAULT_THRESHOLDS)).toEqual(['DOWN1', 'UP1']);
  });

  it('skips the Unknown sentinel the backend substitutes for a missing gene column', () => {
    const cloud = [
      point({ gene: UNKNOWN_GENE, x: 3, padj: 1e-9 }),
      point({ gene: '', x: 3, padj: 1e-9 }),
      point({ gene: 'TP53', x: 3, padj: 1e-9 }),
    ];
    expect(significantGenes(cloud, DEFAULT_THRESHOLDS)).toEqual(['TP53']);
  });
});
