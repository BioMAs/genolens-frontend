import {
  PARAM_GENE,
  PARAM_GENE_LIST,
  readGeneListId,
  PARAM_LOGFC,
  PARAM_PADJ,
  readFocusedGene,
  readThresholds,
  thresholdsAreImplicit,
  thresholdsMatchUrl,
  urlMatchesState,
  writeExplorerState,
  writeThresholds,
} from '@/components/comparison/explorerUrl';
import { DEFAULT_THRESHOLDS } from '@/utils/volcano';

const params = (query: string) => new URLSearchParams(query);

describe('readThresholds', () => {
  it('reads a tightened pair from the URL', () => {
    expect(readThresholds(params('padj=0.01&lfc=1.5'))).toEqual({ padj: 0.01, logfc: 1.5 });
  });

  it('falls back to the defaults when the URL says nothing', () => {
    expect(readThresholds(params(''))).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(null)).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(undefined)).toEqual(DEFAULT_THRESHOLDS);
  });

  it('reads each parameter independently', () => {
    expect(readThresholds(params('padj=0.001'))).toEqual({
      padj: 0.001,
      logfc: DEFAULT_THRESHOLDS.logfc,
    });
    expect(readThresholds(params('lfc=2'))).toEqual({
      padj: DEFAULT_THRESHOLDS.padj,
      logfc: 2,
    });
  });

  // A hand-edited or truncated URL must land on a working screen, never a blank one.
  it('rejects a non-numeric value instead of poisoning the screen with NaN', () => {
    expect(readThresholds(params('padj=abc&lfc=oops'))).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(params('padj=&lfc=  '))).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(params('padj=Infinity'))).toEqual(DEFAULT_THRESHOLDS);
  });

  it('refuses a threshold looser than ingestion, exactly like the on-screen control', () => {
    expect(readThresholds(params('padj=5'))).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(params('lfc=-1'))).toEqual(DEFAULT_THRESHOLDS);
    expect(readThresholds(params('padj=0.5&lfc=0.1'))).toEqual(DEFAULT_THRESHOLDS);
  });

  it('keeps a padj usable when the URL says zero', () => {
    expect(readThresholds(params('padj=0')).padj).toBeGreaterThan(0);
  });
});

describe('writeThresholds', () => {
  it('omits a threshold sitting at its default', () => {
    expect(writeThresholds(params(''), DEFAULT_THRESHOLDS).toString()).toBe('');
  });

  it('writes only what departs from the default', () => {
    const written = writeThresholds(params(''), { padj: 0.01, logfc: DEFAULT_THRESHOLDS.logfc });
    expect(written.get(PARAM_PADJ)).toBe('0.01');
    expect(written.has(PARAM_LOGFC)).toBe(false);
  });

  it('writes both when both depart', () => {
    const written = writeThresholds(params(''), { padj: 0.001, logfc: 2 });
    expect(written.get(PARAM_PADJ)).toBe('0.001');
    expect(written.get(PARAM_LOGFC)).toBe('2');
  });

  it('deletes a stale parameter when the value returns to its default', () => {
    const written = writeThresholds(params('padj=0.01&lfc=2'), DEFAULT_THRESHOLDS);
    expect(written.toString()).toBe('');
  });

  it('leaves unrelated parameters alone', () => {
    const written = writeThresholds(params('tab=deg&datasetId=abc'), { padj: 0.01, logfc: 1 });
    expect(written.get('tab')).toBe('deg');
    expect(written.get('datasetId')).toBe('abc');
  });

  it('never mutates its input', () => {
    const original = params('tab=deg');
    writeThresholds(original, { padj: 0.01, logfc: 2 });
    expect(original.toString()).toBe('tab=deg');
  });

  it('clamps before writing, so the URL can never advertise a loose threshold', () => {
    const written = writeThresholds(params(''), { padj: 0.9, logfc: 0 });
    expect(written.toString()).toBe('');
  });

  it('round-trips through readThresholds', () => {
    for (const t of [
      { padj: 0.01, logfc: 1.5 },
      { padj: 0.001, logfc: DEFAULT_THRESHOLDS.logfc },
      DEFAULT_THRESHOLDS,
    ]) {
      expect(readThresholds(writeThresholds(params('tab=deg'), t))).toEqual(t);
    }
  });
});

describe('thresholdsMatchUrl', () => {
  it('is true when a write would change nothing', () => {
    expect(thresholdsMatchUrl(params('padj=0.01'), { padj: 0.01, logfc: 0.58 })).toBe(true);
    expect(thresholdsMatchUrl(params(''), DEFAULT_THRESHOLDS)).toBe(true);
  });

  it('is false when a write would change the query string', () => {
    expect(thresholdsMatchUrl(params(''), { padj: 0.01, logfc: 0.58 })).toBe(false);
    expect(thresholdsMatchUrl(params('padj=0.01'), DEFAULT_THRESHOLDS)).toBe(false);
  });

  // Guards the history write: without this, a keystroke resolving to the same number would
  // still push another replaceState and re-run every useSearchParams consumer.
  it('ignores a difference in spelling that resolves to the same number', () => {
    expect(thresholdsMatchUrl(params('padj=0.01'), { padj: 0.0100, logfc: 0.58 })).toBe(true);
  });
});

describe('thresholdsAreImplicit', () => {
  it('recognises the defaults, including a value that clamps back onto them', () => {
    expect(thresholdsAreImplicit(DEFAULT_THRESHOLDS)).toBe(true);
    expect(thresholdsAreImplicit({ padj: 0.9, logfc: 0 })).toBe(true);
    expect(thresholdsAreImplicit({ padj: 0.01, logfc: 0.58 })).toBe(false);
  });
});

describe('readFocusedGene', () => {
  it('reads a gene, keeping the spelling the link used', () => {
    // Upper-casing here would render a mouse gene Sox9 as SOX9
    expect(readFocusedGene(params('gene=Sox9'))).toBe('Sox9');
    expect(readFocusedGene(params('gene=ENSG00000141510'))).toBe('ENSG00000141510');
    expect(readFocusedGene(params('gene=HLA-DRB1'))).toBe('HLA-DRB1');
  });

  it('trims surrounding whitespace', () => {
    expect(readFocusedGene(params('gene=%20TP53%20'))).toBe('TP53');
  });

  it('returns null when no gene is named', () => {
    expect(readFocusedGene(params(''))).toBeNull();
    expect(readFocusedGene(params('gene='))).toBeNull();
    expect(readFocusedGene(params('gene=%20%20'))).toBeNull();
    expect(readFocusedGene(null)).toBeNull();
  });

  // A bad key would otherwise travel into lookups and into the card's heading.
  it('rejects a value that cannot be a gene key', () => {
    expect(readFocusedGene(params('gene=' + encodeURIComponent('TP53 OR 1=1')))).toBeNull();
    expect(readFocusedGene(params('gene=' + encodeURIComponent('<script>')))).toBeNull();
    expect(readFocusedGene(params('gene=' + 'A'.repeat(65)))).toBeNull();
  });
});

describe('writeExplorerState', () => {
  it('writes the gene alongside the thresholds', () => {
    const written = writeExplorerState(params(''), { padj: 0.01, logfc: 2 }, 'TP53');

    expect(written.get(PARAM_GENE)).toBe('TP53');
    expect(written.get(PARAM_PADJ)).toBe('0.01');
    expect(written.get(PARAM_LOGFC)).toBe('2');
  });

  it('drops the gene when nothing is focused', () => {
    expect(writeExplorerState(params('gene=TP53'), DEFAULT_THRESHOLDS, null).toString()).toBe('');
    expect(
      writeExplorerState(params('gene=TP53'), DEFAULT_THRESHOLDS, '   ').toString()
    ).toBe('');
  });

  it('leaves unrelated parameters alone and never mutates its input', () => {
    const original = params('tab=deg');
    const written = writeExplorerState(original, DEFAULT_THRESHOLDS, 'TP53');

    expect(written.get('tab')).toBe('deg');
    expect(original.has(PARAM_GENE)).toBe(false);
  });

  it('round-trips through readFocusedGene', () => {
    const written = writeExplorerState(params(''), DEFAULT_THRESHOLDS, 'Sox9');
    expect(readFocusedGene(written)).toBe('Sox9');
  });
});

describe('urlMatchesState', () => {
  it('is true when a write would change nothing', () => {
    expect(urlMatchesState(params('gene=TP53'), DEFAULT_THRESHOLDS, 'TP53')).toBe(true);
    expect(urlMatchesState(params(''), DEFAULT_THRESHOLDS, null)).toBe(true);
  });

  it('is false when the gene or a threshold differs', () => {
    expect(urlMatchesState(params(''), DEFAULT_THRESHOLDS, 'TP53')).toBe(false);
    expect(urlMatchesState(params('gene=TP53'), DEFAULT_THRESHOLDS, 'SOX9')).toBe(false);
    expect(urlMatchesState(params('gene=TP53'), { padj: 0.01, logfc: 0.58 }, 'TP53')).toBe(false);
  });
});

describe('readGeneListId', () => {
  it('reads a saved gene list id', () => {
    expect(readGeneListId(params('geneList=3a39cc1a-1111-2222-3333-444455556666'))).toBe(
      '3a39cc1a-1111-2222-3333-444455556666'
    );
  });

  it('returns null when none is named', () => {
    expect(readGeneListId(params(''))).toBeNull();
    expect(readGeneListId(params('geneList='))).toBeNull();
    expect(readGeneListId(null)).toBeNull();
  });

  // The id becomes a path segment on the API, so a mangled link is refused rather than sent.
  it('refuses anything that is not an id', () => {
    expect(readGeneListId(params('geneList=' + encodeURIComponent('../../admin')))).toBeNull();
    expect(readGeneListId(params('geneList=short'))).toBeNull();
    expect(readGeneListId(params('geneList=' + 'a'.repeat(65)))).toBeNull();
  });
});

describe('the gene list in the URL', () => {
  const LIST = '3a39cc1a-1111-2222-3333-444455556666';

  // A set of genes is only shareable once saved: the id travels, the three hundred symbols
  // never do.
  it('writes the list id', () => {
    const written = writeExplorerState(params(''), DEFAULT_THRESHOLDS, null, LIST);
    expect(written.get(PARAM_GENE_LIST)).toBe(LIST);
    expect(written.has(PARAM_GENE)).toBe(false);
  });

  it('drops the list id when the selection is no longer a saved list', () => {
    expect(
      writeExplorerState(params(`geneList=${LIST}`), DEFAULT_THRESHOLDS, null, null).toString()
    ).toBe('');
  });

  it('carries a focused gene and a list together', () => {
    const written = writeExplorerState(params(''), DEFAULT_THRESHOLDS, 'TP53', LIST);
    expect(written.get(PARAM_GENE)).toBe('TP53');
    expect(written.get(PARAM_GENE_LIST)).toBe(LIST);
  });

  it('round-trips through readGeneListId', () => {
    expect(readGeneListId(writeExplorerState(params(''), DEFAULT_THRESHOLDS, null, LIST))).toBe(
      LIST
    );
  });

  it('is seen by urlMatchesState', () => {
    expect(urlMatchesState(params(`geneList=${LIST}`), DEFAULT_THRESHOLDS, null, LIST)).toBe(true);
    expect(urlMatchesState(params(''), DEFAULT_THRESHOLDS, null, LIST)).toBe(false);
  });
});
