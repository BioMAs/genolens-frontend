import {
  checkContrastFile,
  contrastHeaderWarning,
  missingContrastColumns,
  splitHeader,
} from '@/lib/contrastHeader';

describe('splitHeader', () => {
  it('splits on tabs, commas or semicolons and normalises case, quotes and BOM', () => {
    expect(splitHeader('comparison\tcondition1\tcondition2')).toEqual(['comparison', 'condition1', 'condition2']);
    expect(splitHeader('﻿"Comparison", Condition1 ,CONDITION2\r')).toEqual(['comparison', 'condition1', 'condition2']);
    expect(splitHeader('name;test;ref')).toEqual(['name', 'test', 'ref']);
  });
});

describe('missingContrastColumns', () => {
  it('accepts the layout ContrastBuilder writes', () => {
    expect(missingContrastColumns('comparison\tcondition1\tcondition2')).toEqual([]);
  });

  it('accepts every alias the R pipeline accepts', () => {
    expect(missingContrastColumns('comparison_id\tnumerator\tdenominator')).toEqual([]);
    expect(missingContrastColumns('contrast\tgroup1\tgroup2')).toEqual([]);
    expect(missingContrastColumns('comparison_name,test,ref,perform_analysis')).toEqual([]);
  });

  it('flags the old two-column group1/group2 example as missing a name column', () => {
    expect(missingContrastColumns('group1,group2')).toEqual(['name']);
  });

  it('lists every missing kind in pipeline order', () => {
    expect(missingContrastColumns('foo\tbar')).toEqual(['name', 'test', 'reference']);
    expect(missingContrastColumns('comparison\tcondition1')).toEqual(['reference']);
  });
});

describe('contrastHeaderWarning', () => {
  it('returns null for a valid header', () => {
    expect(contrastHeaderWarning('comparison\tcondition1\tcondition2')).toBeNull();
  });

  it('names the missing column and the expected layout', () => {
    const msg = contrastHeaderWarning('group1\tgroup2');
    expect(msg).toContain('comparison name column');
    expect(msg).not.toContain('test condition column');
    expect(msg).toContain('comparison, condition1 (test) and condition2 (reference)');
  });
});

describe('checkContrastFile', () => {
  const file = (name: string, content: string) => new File([content], name, { type: 'text/plain' });

  it('reads the first non-empty line of a text file', async () => {
    await expect(checkContrastFile(file('c.tsv', '\ncomparison\tcondition1\tcondition2\nA_vs_B\tA\tB\n'))).resolves.toBeNull();
    await expect(checkContrastFile(file('c.csv', 'group1,group2\nA,B\n'))).resolves.toContain('comparison name column');
  });

  it('skips Excel files, which are not parsed client-side', async () => {
    await expect(checkContrastFile(file('c.xlsx', 'group1,group2'))).resolves.toBeNull();
  });
});
