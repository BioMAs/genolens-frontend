import {
  buildGeneIndex,
  buildGeneIndexFromNameMap,
  geneKeyAliases,
  intersectWithIndex,
  normalizeGeneKey,
  resolveGene,
  stripEnsemblVersion,
} from '@/utils/geneKeys';

describe('normalizeGeneKey', () => {
  it('trims and upper-cases so two spellings of one gene compare equal', () => {
    expect(normalizeGeneKey('  tp53 ')).toBe('TP53');
    expect(normalizeGeneKey('Tp53')).toBe(normalizeGeneKey('TP53'));
  });

  it('collapses every empty form to the empty string', () => {
    expect(normalizeGeneKey(null)).toBe('');
    expect(normalizeGeneKey(undefined)).toBe('');
    expect(normalizeGeneKey('   ')).toBe('');
  });
});

describe('stripEnsemblVersion', () => {
  it('drops the version suffix from an Ensembl accession', () => {
    expect(stripEnsemblVersion('ENSG00000141510.17')).toBe('ENSG00000141510');
    expect(stripEnsemblVersion('ensmusg00000059552.14')).toBe('ENSMUSG00000059552');
    expect(stripEnsemblVersion('ENST00000269305.9')).toBe('ENST00000269305');
  });

  it('leaves an unversioned accession alone', () => {
    expect(stripEnsemblVersion('ENSG00000141510')).toBe('ENSG00000141510');
  });

  it('never rewrites a symbol that merely contains a dot', () => {
    expect(stripEnsemblVersion('HLA-DRB1')).toBe('HLA-DRB1');
    expect(stripEnsemblVersion('C1orf134')).toBe('C1ORF134');
    expect(stripEnsemblVersion('MT-CO1.2')).toBe('MT-CO1.2');
  });
});

describe('geneKeyAliases', () => {
  it('yields both forms for a versioned Ensembl id, specific first', () => {
    expect(geneKeyAliases('ENSG00000141510.17')).toEqual([
      'ENSG00000141510.17',
      'ENSG00000141510',
    ]);
  });

  it('yields a single form for anything else', () => {
    expect(geneKeyAliases('TP53')).toEqual(['TP53']);
    expect(geneKeyAliases('ENSG00000141510')).toEqual(['ENSG00000141510']);
  });

  it('yields nothing for an empty key, so a missing gene cannot collide', () => {
    expect(geneKeyAliases('')).toEqual([]);
    expect(geneKeyAliases(null)).toEqual([]);
    expect(geneKeyAliases('  ')).toEqual([]);
  });
});

describe('buildGeneIndex', () => {
  const index = buildGeneIndex([
    { id: 'ENSG00000141510', symbol: 'TP53' },
    { id: 'ENSG00000181143.18', symbol: 'MUC16' },
    { id: 'SOX9' },
  ]);

  it('counts distinct genes, not aliases', () => {
    expect(index.size).toBe(3);
  });

  it('resolves a gene by its id or by its symbol, to the same identity', () => {
    const byId = index.resolve('ENSG00000141510');
    const bySymbol = index.resolve('TP53');

    expect(byId).toEqual({ id: 'ENSG00000141510', symbol: 'TP53' });
    expect(bySymbol).toBe(byId);
  });

  it('resolves regardless of case or surrounding whitespace', () => {
    expect(index.resolve('  tp53 ')).toEqual({ id: 'ENSG00000141510', symbol: 'TP53' });
  });

  it('matches a versioned id against its unversioned form and back', () => {
    // indexed versioned, looked up bare
    expect(index.resolve('ENSG00000181143')?.symbol).toBe('MUC16');
    // indexed bare, looked up versioned — the volcano and the table disagree on this exact point
    expect(index.resolve('ENSG00000141510.9')?.symbol).toBe('TP53');
  });

  it('returns null for a gene it has never seen', () => {
    expect(index.resolve('BRCA1')).toBeNull();
    expect(index.resolve('')).toBeNull();
    expect(index.resolve(null)).toBeNull();
  });

  it('records a null symbol when the source only knew one name', () => {
    expect(index.resolve('SOX9')).toEqual({ id: 'SOX9', symbol: null });
  });

  it('skips entries with no usable id', () => {
    const sparse = buildGeneIndex([
      { id: '', symbol: 'GHOST' },
      { id: null, symbol: 'ALSO_GHOST' },
      { id: 'TP53' },
    ]);

    expect(sparse.size).toBe(1);
    expect(sparse.resolve('GHOST')).toBeNull();
  });

  it('lets the first source win when two entries claim the same alias', () => {
    const clashing = buildGeneIndex([
      { id: 'ENSG00000141510', symbol: 'TP53' },
      { id: 'ENSG00000999999', symbol: 'TP53' },
    ]);

    expect(clashing.resolve('TP53')?.id).toBe('ENSG00000141510');
    // the loser keeps its own id, which nothing else had claimed
    expect(clashing.resolve('ENSG00000999999')?.id).toBe('ENSG00000999999');
  });
});

describe('GeneIndex.symbolOf', () => {
  const index = buildGeneIndex([
    { id: 'ENSG00000141510', symbol: 'TP53' },
    { id: 'SOX9' },
  ]);

  it('gives the symbol when it is known', () => {
    expect(index.symbolOf('ENSG00000141510')).toBe('TP53');
  });

  it('falls back to the id when the gene has no symbol', () => {
    expect(index.symbolOf('SOX9')).toBe('SOX9');
  });

  it('falls back to the normalised input for an unknown gene', () => {
    expect(index.symbolOf(' brca1 ')).toBe('BRCA1');
  });
});

describe('buildGeneIndexFromNameMap', () => {
  it('reads the Record<gene_id, gene_name> shape ComparisonDetail already assembles', () => {
    const index = buildGeneIndexFromNameMap({
      ENSG00000141510: 'TP53',
      ENSG00000181143: 'MUC16',
    });

    expect(index.size).toBe(2);
    expect(index.resolve('MUC16')?.id).toBe('ENSG00000181143');
  });

  it('survives an empty map', () => {
    const index = buildGeneIndexFromNameMap({});
    expect(index.size).toBe(0);
    expect(index.resolve('TP53')).toBeNull();
  });
});

describe('resolveGene', () => {
  const index = buildGeneIndex([{ id: 'ENSG00000141510', symbol: 'TP53' }]);

  it('resolves through the index when the gene is known', () => {
    expect(resolveGene('TP53', index)).toEqual({ id: 'ENSG00000141510', symbol: 'TP53' });
  });

  it('falls back to the normalised key for a gene absent from the index', () => {
    // routine: deg_genes only holds genes already significant at ingestion, so a volcano
    // point can legitimately have no DEG row
    expect(resolveGene(' brca1 ', index)).toEqual({ id: 'BRCA1', symbol: null });
  });

  it('works with no index at all', () => {
    expect(resolveGene('TP53', null)).toEqual({ id: 'TP53', symbol: null });
  });

  it('still refuses an empty key', () => {
    expect(resolveGene('', index)).toBeNull();
    expect(resolveGene(null, index)).toBeNull();
  });
});

describe('intersectWithIndex', () => {
  const index = buildGeneIndex([
    { id: 'ENSG00000141510', symbol: 'TP53' },
    { id: 'ENSG00000181143', symbol: 'MUC16' },
  ]);

  it('keeps only known genes, in input order', () => {
    const kept = intersectWithIndex(['MUC16', 'BRCA1', 'TP53'], index);
    expect(kept.map((g) => g.symbol)).toEqual(['MUC16', 'TP53']);
  });

  it('deduplicates two aliases of the same gene', () => {
    const kept = intersectWithIndex(['TP53', 'ENSG00000141510', 'ENSG00000141510.17'], index);
    expect(kept).toHaveLength(1);
    expect(kept[0].id).toBe('ENSG00000141510');
  });

  it('ignores empty entries', () => {
    expect(intersectWithIndex(['', null, undefined, 'TP53'], index)).toHaveLength(1);
  });
});
