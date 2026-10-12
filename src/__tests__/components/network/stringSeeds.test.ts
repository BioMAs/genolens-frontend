import {
  HUMAN_TAXON,
  stringTaxon,
  symbolLookup,
  toStringSymbol,
  toStringSymbols,
} from '@/components/network/stringSeeds';

/**
 * What the interaction network asks STRING for. Both defects these cover painted "no
 * interaction at this confidence" over a real failure: versioned Ensembl ids (STRING 404s on the
 * suffix) and mouse genes sent as human.
 */
describe('toStringSymbol', () => {
  const lookup = symbolLookup({
    'ENSG00000141510.17': 'TP53',
    ENSMUSG00000059552: 'Trp53',
    ENSG00000000003: '',
  });

  it('asks for the symbol the matrix knows, whatever version the id carries', () => {
    expect(toStringSymbol('ENSG00000141510.17', lookup)).toBe('TP53');
    expect(toStringSymbol('ENSG00000141510', lookup)).toBe('TP53');
    expect(toStringSymbol('ensg00000141510.3', lookup)).toBe('TP53');
  });

  it('keeps the case of a rodent symbol', () => {
    expect(toStringSymbol('ENSMUSG00000059552', lookup)).toBe('Trp53');
  });

  it('drops the version of an Ensembl id it has no symbol for', () => {
    expect(toStringSymbol('ENSG00000000003.15', lookup)).toBe('ENSG00000000003');
  });

  it('passes a symbol through, dot and all', () => {
    expect(toStringSymbol('HLA-DRB1', lookup)).toBe('HLA-DRB1');
    expect(toStringSymbol(' Actb ', lookup)).toBe('Actb');
  });
});

describe('toStringSymbols', () => {
  it('deduplicates genes that name the same symbol, keeping the first in order', () => {
    const lookup = symbolLookup({ 'ENSG00000141510.17': 'TP53' });
    expect(
      toStringSymbols(['ENSG00000141510.17', 'BRCA1', 'tp53', 'ENSG00000141510', ''], lookup)
    ).toEqual(['TP53', 'BRCA1']);
  });

  it('tolerates a missing name map', () => {
    expect(toStringSymbols(['ENSG00000141510.17'], symbolLookup(undefined))).toEqual([
      'ENSG00000141510',
    ]);
  });
});

describe('stringTaxon', () => {
  it('honours a declared species under any common spelling', () => {
    expect(stringTaxon('mouse', [])).toBe(10090);
    expect(stringTaxon('Mus musculus', [])).toBe(10090);
    expect(stringTaxon('Rattus_norvegicus', [])).toBe(10116);
    expect(stringTaxon('zebrafish', [])).toBe(7955);
    expect(stringTaxon('10090', [])).toBe(10090);
  });

  it('reads the organism off Ensembl ids when nothing is declared', () => {
    expect(stringTaxon(null, ['ENSMUSG00000059552.4'])).toBe(10090);
    expect(stringTaxon(undefined, ['ENSRNOG00000010756'])).toBe(10116);
    expect(stringTaxon('', ['ENSG00000141510'])).toBe(HUMAN_TAXON);
  });

  it('reads rodent nomenclature off title-case symbols', () => {
    expect(stringTaxon(null, ['Trp53', 'Cdkn1a', 'Mdm2'])).toBe(10090);
  });

  it('stays human for upper-case symbols, orf names included', () => {
    expect(stringTaxon(null, ['TP53', 'C1orf112', 'CDKN1A'])).toBe(HUMAN_TAXON);
  });

  it('defaults to human with nothing to go on', () => {
    expect(stringTaxon('unknown beast', [])).toBe(HUMAN_TAXON);
  });
});
