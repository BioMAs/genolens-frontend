/**
 * The three pure functions behind the gene detail card.
 *
 * Each turns data the API already returns into an answer the card can show. Tested without a
 * fetch, because the shaping is where the mistakes are: which sample belongs to which
 * condition, which node is a partner rather than the seed, and which pathway contains a gene.
 */
import {
  groupByCondition,
  parseConditions,
} from '@/hooks/useGeneExpressionByCondition';
import { partnersFromNetwork } from '@/hooks/useStringPartners';
import { invertPathways } from '@/hooks/useGeneToPathways';

describe('parseConditions', () => {
  it('splits the usual A_vs_B shape', () => {
    expect(parseConditions('Treated_vs_Control')).toEqual(['Treated', 'Control']);
  });

  it('accepts the looser separators names use in the wild', () => {
    expect(parseConditions('KO vs WT')).toEqual(['KO', 'WT']);
    expect(parseConditions('KO-vs-WT')).toEqual(['KO', 'WT']);
  });

  it('yields the whole name and an empty second when it does not split', () => {
    expect(parseConditions('SomeAnalysis')).toEqual(['SomeAnalysis', '']);
  });
});

describe('groupByCondition', () => {
  const row = { gene_id: 'TP53', s1: '10', s2: '12', s3: '4', s4: '5' };
  const samples = ['s1', 's2', 's3', 's4'];

  it('uses the sample-to-condition metadata when there is any', () => {
    const groups = groupByCondition(row, samples, ['Treated', 'Control'], {
      s1: 'Treated',
      s2: 'Treated',
      s3: 'Control',
      s4: 'Control',
    });

    expect(groups.map((g) => g.name)).toEqual(['Treated', 'Control']);
    expect(groups[0].values).toEqual([10, 12]);
    expect(groups[1].values).toEqual([4, 5]);
  });

  // How older datasets were readable at all: no metadata, so the sample's own name decides.
  it('falls back to matching the condition inside the sample name', () => {
    const named = { gene_id: 'TP53', Treated_1: '10', Control_1: '4' };
    const groups = groupByCondition(named, ['Treated_1', 'Control_1'], ['Treated', 'Control']);

    expect(groups[0].values).toEqual([10]);
    expect(groups[1].values).toEqual([4]);
  });

  // Showing the values without a split beats showing nothing at all.
  it('puts everything in one unnamed group when neither condition matches', () => {
    const groups = groupByCondition(row, samples, ['Absent', 'AlsoAbsent']);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('All samples');
    expect(groups[0].values).toEqual([10, 12, 4, 5]);
  });

  it('skips a sample whose value is not a number', () => {
    const gappy = { gene_id: 'TP53', s1: '10', s2: 'NA', s3: '' };
    const groups = groupByCondition(gappy, ['s1', 's2', 's3'], ['A', 'B'], {
      s1: 'A',
      s2: 'A',
      s3: 'A',
    });

    expect(groups[0].values).toEqual([10]);
  });

  it('ignores the gene column itself, which is not a sample', () => {
    const groups = groupByCondition(row, samples, ['Treated', 'Control'], { s1: 'Treated' });
    expect(groups.flatMap((g) => g.samples.map((s) => s.sample))).not.toContain('gene_id');
  });
});

describe('partnersFromNetwork', () => {
  const network = {
    nodes: [
      { name: 'TP53', annotation: 'the seed' },
      { name: 'MDM2', annotation: 'a partner' },
      { name: 'CDKN1A' },
    ],
    edges: [
      { source: 'TP53', target: 'MDM2', score: 0.99 },
      { source: 'CDKN1A', target: 'TP53', score: 0.8 },
      { source: 'MDM2', target: 'CDKN1A', score: 0.7 },
    ],
  };

  it('drops the seed and keeps its partners', () => {
    const partners = partnersFromNetwork(network, 'TP53');
    expect(partners.map((p) => p.name)).toEqual(['MDM2', 'CDKN1A']);
  });

  it('scores each partner by its edge to the seed, not to each other', () => {
    const partners = partnersFromNetwork(network, 'TP53');
    // the MDM2–CDKN1A edge at 0.7 must not become CDKN1A's score
    expect(partners.find((p) => p.name === 'CDKN1A')?.score).toBe(0.8);
  });

  it('ranks the strongest interaction first, whichever way the edge is written', () => {
    const partners = partnersFromNetwork(network, 'TP53');
    expect(partners[0].name).toBe('MDM2');
  });

  it('matches the seed regardless of case', () => {
    expect(partnersFromNetwork(network, 'tp53').map((p) => p.name)).toEqual(['MDM2', 'CDKN1A']);
  });

  it('keeps the strongest when STRING reports a pair twice', () => {
    const duplicated = {
      nodes: [{ name: 'TP53' }, { name: 'MDM2' }],
      edges: [
        { source: 'TP53', target: 'MDM2', score: 0.4 },
        { source: 'MDM2', target: 'TP53', score: 0.9 },
      ],
    };
    expect(partnersFromNetwork(duplicated, 'TP53')[0].score).toBe(0.9);
  });

  it('survives an empty or partial payload', () => {
    expect(partnersFromNetwork({}, 'TP53')).toEqual([]);
    expect(partnersFromNetwork({ nodes: [{ name: 'TP53' }] }, 'TP53')).toEqual([]);
  });
});

describe('invertPathways', () => {
  const rows = [
    { pathway_id: 'GO:1', pathway_name: 'Cell cycle', padj: 0.01, genes: ['TP53', 'MDM2'] },
    { pathway_id: 'GO:2', pathway_name: 'Apoptosis', padj: 1e-6, genes: ['TP53'] },
    { pathway_id: 'GO:3', pathway_name: 'Unscored', padj: null, genes: ['TP53'] },
  ];

  it('lists every pathway a gene appears in', () => {
    const index = invertPathways(rows);
    expect(index.get('TP53')?.map((p) => p.name)).toEqual(['Apoptosis', 'Cell cycle', 'Unscored']);
  });

  it('orders them most significant first', () => {
    const index = invertPathways(rows);
    expect(index.get('TP53')?.[0].padj).toBe(1e-6);
  });

  // A missing padj must sort last rather than winning by comparing as zero.
  it('sorts an unscored pathway last', () => {
    const index = invertPathways(rows);
    expect(index.get('TP53')?.at(-1)?.name).toBe('Unscored');
  });

  it('matches a gene regardless of case', () => {
    const index = invertPathways([{ pathway_id: 'GO:1', pathway_name: 'X', genes: ['Sox9'] }]);
    expect(index.get('SOX9')).toHaveLength(1);
  });

  it('knows nothing about a gene in no pathway', () => {
    expect(invertPathways(rows).get('BRCA1')).toBeUndefined();
  });

  it('skips a row with no identity at all', () => {
    const index = invertPathways([{ genes: ['TP53'] }, ...rows]);
    expect(index.get('TP53')).toHaveLength(3);
  });

  it('survives an empty payload', () => {
    expect(invertPathways([]).size).toBe(0);
  });
});
