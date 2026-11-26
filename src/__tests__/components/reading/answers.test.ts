/**
 * The five answers of the reading, as one-line statements computed from data.
 *
 * One case per branch of each answer: the copy is the contract (it is what the reader sees under
 * each question), and the `by` field is the contract with the spine (it decides whether the
 * "written by the model" mention shows, and whether the line reads as a placeholder).
 */
import {
  buildAnswers,
  isClaimSupported,
  NO_ENRICHMENT_FILE,
  NO_PROCESS_ENRICHED,
  type AnswersInput,
} from '@/components/reading/answers';
import type { TopPathway } from '@/hooks/useTopPathways';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { NovaClaim } from '@/types/cosmomics';

const access: ModuleAccess = {
  skin: true,
  targets: true,
  science: true,
  report: true,
  ai: true,
  loaded: true,
};

const claim = (name: string, over: Partial<NovaClaim> = {}): NovaClaim => ({
  name,
  importance: 1,
  s_pro: 2,
  s_anti: 0.5,
  coherence: 0.8,
  n_for: 3,
  n_against: 1,
  subgroups: [],
  ...over,
});

const pathway = (
  name: string,
  direction: TopPathway['direction'],
  over: Partial<TopPathway> = {}
): TopPathway => ({
  id: `GO:${name}`,
  name,
  padj: 0.001,
  geneCount: 12,
  genes: [],
  direction,
  ...over,
});

const base = (over: Partial<AnswersInput> = {}): AnswersInput => ({
  summary: { up: 274, down: 181, ns: 19000, significant: 455, total: 19455 },
  tested: 20000,
  topUp: ['IL6', 'PTGS2', 'CXCL8'],
  topDown: ['KRT1', 'LCE1A'],
  pathways: [
    pathway('Inflammatory response', 'up'),
    pathway('Epidermis development', 'down'),
  ],
  interpretation: 'Inflammation rises while the barrier falls. More detail follows.',
  access,
  claims: [claim('Barrier')],
  ...over,
});

describe('buildAnswers — 1, how many genes change', () => {
  it('counts up and down against the genes tested', () => {
    expect(buildAnswers(base()).counts).toEqual({
      text: '274 up and 181 down, of 20,000 genes tested',
      by: 'data',
    });
  });

  it('groups thousands with a comma, on up, down and tested alike', () => {
    const summary = { up: 1284, down: 902, ns: 17000, significant: 2186, total: 19186 };
    expect(buildAnswers(base({ summary, tested: 20000 })).counts.text).toBe(
      '1,284 up and 902 down, of 20,000 genes tested'
    );
    expect(buildAnswers(base({ summary, tested: null })).counts.text).toBe('1,284 up and 902 down');
    const huge = { up: 1234567, down: 1000, ns: 0, significant: 1235567, total: 1235567 };
    expect(buildAnswers(base({ summary: huge, tested: 1500000 })).counts.text).toBe(
      '1,234,567 up and 1,000 down, of 1,500,000 genes tested'
    );
  });

  it('leaves numbers under a thousand alone', () => {
    const summary = { up: 999, down: 0, ns: 1, significant: 999, total: 1000 };
    expect(buildAnswers(base({ summary, tested: 999 })).counts.text).toBe(
      '999 up and 0 down, of 999 genes tested'
    );
  });

  it('drops the tested part when it is unknown', () => {
    expect(buildAnswers(base({ tested: null })).counts.text).toBe('274 up and 181 down');
  });

  it('never takes the genes tested from the significance summary', () => {
    // `total` (19455) is what the volcano drew, not what was tested.
    for (const tested of [20000, null]) {
      const text = buildAnswers(base({ tested })).counts.text;
      expect(text).not.toContain('19455');
      expect(text).not.toContain('19,455');
    }
  });

  it('is pending while the summary is not there yet', () => {
    expect(buildAnswers(base({ summary: null })).counts).toEqual({
      text: 'Counting genes…',
      by: 'pending',
    });
  });

  it('still says so when nothing changes', () => {
    const summary = { up: 0, down: 0, ns: 100, significant: 0, total: 100 };
    expect(buildAnswers(base({ summary, tested: 100 })).counts.text).toBe(
      '0 up and 0 down, of 100 genes tested'
    );
  });
});

describe('buildAnswers — 2, which genes matter most', () => {
  it('names both ends', () => {
    expect(buildAnswers(base()).genes).toEqual({
      text: 'IL6, PTGS2 and CXCL8 rise most; KRT1 and LCE1A fall most',
      by: 'data',
    });
  });

  it('lists two genes with "and" and no comma', () => {
    expect(buildAnswers(base({ topUp: ['IL6', 'PTGS2'] })).genes.text).toMatch(/^IL6 and PTGS2 rise most/);
  });

  it('agrees the verb with a single gene, on either side', () => {
    expect(buildAnswers(base({ topUp: ['IL6'], topDown: ['KRT1'] })).genes.text).toBe(
      'IL6 rises most; KRT1 falls most'
    );
  });

  it('keeps only the half that exists', () => {
    expect(buildAnswers(base({ topDown: [] })).genes.text).toBe('IL6, PTGS2 and CXCL8 rise most');
    expect(buildAnswers(base({ topUp: [], topDown: ['KRT1'] })).genes.text).toBe('KRT1 falls most');
    expect(buildAnswers(base({ topUp: ['IL6', 'PTGS2'], topDown: [] })).genes.text).toBe(
      'IL6 and PTGS2 rise most'
    );
  });

  it('says that no gene passes when both ends are empty', () => {
    expect(buildAnswers(base({ topUp: [], topDown: [] })).genes).toEqual({
      text: 'No gene passes the thresholds',
      by: 'data',
    });
  });

  // The top genes and the counts are read from the same volcano cloud: while it loads, both ends
  // are empty, and "no gene passes" would be a false statement on the page's first frame.
  it('waits for the volcano cloud instead of saying that no gene passes', () => {
    expect(buildAnswers(base({ summary: null, topUp: [], topDown: [] })).genes).toEqual({
      text: 'Ranking genes…',
      by: 'pending',
    });
  });
});

describe('buildAnswers — 3, which processes move', () => {
  it('names the first process of each direction, the second in lower case', () => {
    expect(buildAnswers(base()).processes).toEqual({
      text: 'Inflammatory response rises; epidermis development falls',
      by: 'data',
    });
  });

  it('lowers the initial only when the second letter is lower case', () => {
    const fall = (name: string) =>
      buildAnswers(base({ pathways: [pathway('Interferon signaling', 'up'), pathway(name, 'down')] }))
        .processes.text;
    expect(fall('Cell cycle')).toBe('Interferon signaling rises; cell cycle falls');
    expect(fall('Wnt signaling')).toBe('Interferon signaling rises; wnt signaling falls');
    // An acronym, a gene symbol with a digit, a single capital before a space: all left as written.
    expect(fall('DNA repair')).toBe('Interferon signaling rises; DNA repair falls');
    expect(fall('TNF signaling')).toBe('Interferon signaling rises; TNF signaling falls');
    expect(fall('p53 signalling')).toBe('Interferon signaling rises; p53 signalling falls');
    expect(fall('T cell activation')).toBe('Interferon signaling rises; T cell activation falls');
    expect(fall('NF-kappaB signaling')).toBe('Interferon signaling rises; NF-kappaB signaling falls');
  });

  it('leaves the rest of the name untouched when it lowers the initial', () => {
    const pathways = [pathway('Interferon signaling', 'up'), pathway('Response to IL-6 and TNF', 'down')];
    expect(buildAnswers(base({ pathways })).processes.text).toBe(
      'Interferon signaling rises; response to IL-6 and TNF falls'
    );
  });

  it('never touches the name of a half that stands alone', () => {
    expect(buildAnswers(base({ pathways: [pathway('Cell cycle', 'down')] })).processes.text).toBe('Cell cycle falls');
    expect(buildAnswers(base({ pathways: [pathway('DNA repair', 'down')] })).processes.text).toBe('DNA repair falls');
  });

  it('takes the first of each direction in the order it is given', () => {
    const pathways = [
      pathway('Cell cycle', 'down'),
      pathway('Interferon signaling', 'up'),
      pathway('Keratinization', 'down'),
      pathway('Cytokine signaling', 'up'),
    ];
    expect(buildAnswers(base({ pathways })).processes.text).toBe(
      'Interferon signaling rises; cell cycle falls'
    );
  });

  it('keeps only the half that exists, with its capital', () => {
    expect(buildAnswers(base({ pathways: [pathway('Interferon signaling', 'up')] })).processes.text).toBe(
      'Interferon signaling rises'
    );
    expect(buildAnswers(base({ pathways: [pathway('Cell cycle', 'down')] })).processes.text).toBe(
      'Cell cycle falls'
    );
  });

  it('says a process is enriched when none has a direction', () => {
    const pathways = [pathway('Wound healing', null), pathway('Angiogenesis', null)];
    expect(buildAnswers(base({ pathways })).processes.text).toBe('Wound healing is enriched');
  });

  it('says there is no enrichment file when pathways is null', () => {
    expect(buildAnswers(base({ pathways: null })).processes.text).toBe(
      'No enrichment file for this comparison'
    );
  });

  it('says no process is enriched when the list is empty', () => {
    expect(buildAnswers(base({ pathways: [] })).processes.text).toBe(
      'No process is enriched at these thresholds'
    );
  });

  // An enrichment file whose pathways have not arrived is not "no enrichment file".
  it('waits for the pathways of an enrichment file instead of saying there is none', () => {
    expect(buildAnswers(base({ pathways: null, pathwaysPending: true })).processes).toEqual({
      text: 'Ranking processes…',
      by: 'pending',
    });
  });

  it('only waits while there are no pathways to read', () => {
    expect(buildAnswers(base({ pathways: [], pathwaysPending: true })).processes.text).toBe(
      NO_PROCESS_ENRICHED
    );
    expect(buildAnswers(base({ pathways: null, pathwaysPending: false })).processes.text).toBe(
      NO_ENRICHMENT_FILE
    );
  });

  it('exports those two sentences, so the Processes chapter says exactly the same thing', () => {
    expect(NO_ENRICHMENT_FILE).toBe('No enrichment file for this comparison');
    expect(NO_PROCESS_ENRICHED).toBe('No process is enriched at these thresholds');
    expect(buildAnswers(base({ pathways: null })).processes.text).toBe(NO_ENRICHMENT_FILE);
    expect(buildAnswers(base({ pathways: [] })).processes.text).toBe(NO_PROCESS_ENRICHED);
  });

  it('is data in every branch', () => {
    for (const pathways of [null, [], [pathway('A', 'up')], [pathway('A', null)]]) {
      expect(buildAnswers(base({ pathways })).processes.by).toBe('data');
    }
  });
});

describe('buildAnswers — 4, what it means biologically', () => {
  it('takes the first sentence of the interpretation, by the model', () => {
    expect(buildAnswers(base()).meaning).toEqual({
      text: 'Inflammation rises while the barrier falls.',
      by: 'model',
    });
  });

  it('is pending when nothing is written', () => {
    expect(buildAnswers(base({ interpretation: null })).meaning).toEqual({
      text: 'Not written yet: open question 4 to write it',
      by: 'pending',
    });
  });

  it('is pending when the text is blank or only headings', () => {
    for (const interpretation of ['', '   \n  ', '# Interpretation\n\n## Summary']) {
      expect(buildAnswers(base({ interpretation })).meaning.by).toBe('pending');
    }
  });

  it('skips headings and reads the first paragraph', () => {
    const interpretation = '# Interpretation\n\n## Summary\n\nThe barrier is lost. Then inflammation.';
    expect(buildAnswers(base({ interpretation })).meaning.text).toBe('The barrier is lost.');
  });

  it('skips a heading glued to its paragraph', () => {
    expect(buildAnswers(base({ interpretation: '## Summary\nThe barrier is lost.' })).meaning.text).toBe(
      'The barrier is lost.'
    );
  });

  it('strips the Markdown emphasis and code marks', () => {
    const interpretation = '**Inflammation** rises, *IL6* and __PTGS2__ lead, via `NFKB1`. Next.';
    expect(buildAnswers(base({ interpretation })).meaning.text).toBe(
      'Inflammation rises, IL6 and PTGS2 lead, via NFKB1.'
    );
  });

  describe('emphasis marks and identifiers with underscores', () => {
    const meaningOf = (interpretation: string) => buildAnswers(base({ interpretation })).meaning.text;

    it('keeps an underscore inside a word: comparison names are not emphasis', () => {
      expect(meaningOf('KO_vs_WT shows a strong response. Next.')).toBe('KO_vs_WT shows a strong response.');
      expect(meaningOf('Treated_vs_Control and Retinol_vs_Vehicle differ. Next.')).toBe(
        'Treated_vs_Control and Retinol_vs_Vehicle differ.'
      );
    });

    it('keeps the underscore of a gene symbol', () => {
      expect(meaningOf('HLA_DRB1 and MT_CO1 rise.')).toBe('HLA_DRB1 and MT_CO1 rise.');
    });

    it('takes a code span verbatim, only the backticks go', () => {
      expect(meaningOf('`KO_vs_WT` shows a strong response.')).toBe('KO_vs_WT shows a strong response.');
      expect(meaningOf('Use `_italic_` and `**bold**` literally.')).toBe('Use _italic_ and **bold** literally.');
    });

    it('strips _italic_ and __bold__ at word boundaries', () => {
      expect(meaningOf('_italic_ rises.')).toBe('italic rises.');
      expect(meaningOf('The _barrier_ falls, __fast__.')).toBe('The barrier falls, fast.');
    });

    it('strips **bold** and *italic*', () => {
      expect(meaningOf('**bold** rises.')).toBe('bold rises.');
      expect(meaningOf('The *barrier* falls.')).toBe('The barrier falls.');
    });

    it('strips emphasis around an identifier without touching its underscores', () => {
      expect(meaningOf('_KO_vs_WT_ rises.')).toBe('KO_vs_WT rises.');
      expect(meaningOf('**HLA_DRB1** rises.')).toBe('HLA_DRB1 rises.');
    });

    it('strips emphasis that wraps a code span, and nested emphasis', () => {
      expect(meaningOf('**Run `KO_vs_WT` now**.')).toBe('Run KO_vs_WT now.');
      expect(meaningOf('**bold and *both* here** rises.')).toBe('bold and both here rises.');
    });

    it('leaves a lone mark that closes nothing as written', () => {
      expect(meaningOf('Significant at p<0.05* only.')).toBe('Significant at p<0.05* only.');
      expect(meaningOf('_private and _other stay.')).toBe('_private and _other stay.');
    });
  });

  it('ends the sentence at ! or ? as well', () => {
    expect(buildAnswers(base({ interpretation: 'Is the barrier lost? Yes.' })).meaning.text).toBe(
      'Is the barrier lost?'
    );
    expect(buildAnswers(base({ interpretation: 'A strong signal! Then more.' })).meaning.text).toBe(
      'A strong signal!'
    );
  });

  it('does not end a sentence on a decimal point', () => {
    expect(
      buildAnswers(base({ interpretation: 'IL6 rises 2.5 fold in the treated group. Next.' })).meaning.text
    ).toBe('IL6 rises 2.5 fold in the treated group.');
  });

  it('keeps a paragraph that has no end mark whole, across its lines', () => {
    expect(buildAnswers(base({ interpretation: 'The barrier\nis lost' })).meaning.text).toBe(
      'The barrier is lost'
    );
  });

  it('reads a numbered or bulleted first paragraph as its text, not as "1."', () => {
    expect(buildAnswers(base({ interpretation: '1. The barrier is lost. 2. Next.' })).meaning.text).toBe(
      'The barrier is lost.'
    );
    expect(buildAnswers(base({ interpretation: '- The barrier is lost.\n- Next.' })).meaning.text).toBe(
      'The barrier is lost.'
    );
  });
});

describe('buildAnswers — 5, what you can apply it to', () => {
  it('waits for the profile before saying anything about the module', () => {
    const waiting = { ...access, skin: false, loaded: false };
    expect(buildAnswers(base({ access: waiting, claims: [claim('Barrier')] })).applications).toEqual({
      text: 'Checking your modules…',
      by: 'pending',
    });
  });

  it('never shows the lock text before the profile is known, whatever the claims are', () => {
    const waiting = { ...access, skin: false, loaded: false };
    for (const claims of [null, [], [claim('Barrier')]]) {
      expect(buildAnswers(base({ access: waiting, claims })).applications.text).not.toMatch(/need the CosmOmics/);
    }
  });

  it('keeps waiting even if a stale skin flag is already on', () => {
    const waiting = { ...access, skin: true, loaded: false };
    expect(buildAnswers(base({ access: waiting })).applications.by).toBe('pending');
  });

  it('shows the lock text once the profile is known and the module is off', () => {
    const locked = { ...access, skin: false, loaded: true };
    expect(buildAnswers(base({ access: locked })).applications.text).toBe('Skin claims need the CosmOmics module');
  });

  it('asks for the CosmOmics module when the skin lock is on', () => {
    const locked = base({ access: { ...access, skin: false }, claims: [claim('Barrier')] });
    expect(buildAnswers(locked).applications).toEqual({
      text: 'Skin claims need the CosmOmics module',
      by: 'data',
    });
  });

  it('says there is no claim data when the module is on but nothing was read', () => {
    expect(buildAnswers(base({ claims: null })).applications.text).toBe(
      'No skin claim data for this comparison'
    );
  });

  it('names one supported claim in the singular', () => {
    expect(buildAnswers(base()).applications).toEqual({
      text: 'Barrier claim supported',
      by: 'data',
    });
  });

  it('names several supported claims in the plural, in the order given', () => {
    const claims = [claim('Barrier'), claim('Anti-aging'), claim('Hydration')];
    expect(buildAnswers(base({ claims })).applications.text).toBe(
      'Barrier, Anti-aging and Hydration claims supported'
    );
    expect(buildAnswers(base({ claims: claims.slice(0, 2) })).applications.text).toBe(
      'Barrier and Anti-aging claims supported'
    );
  });

  it('leaves out the claims that are not supported', () => {
    const claims = [
      claim('Barrier'),
      claim('Whitening', { coherence: 0.3 }),
      claim('Firmness', { n_for: 0 }),
      claim('Hydration'),
    ];
    expect(buildAnswers(base({ claims })).applications.text).toBe('Barrier and Hydration claims supported');
  });

  it('says no claim is supported when none passes, or when the list is empty', () => {
    expect(buildAnswers(base({ claims: [claim('Whitening', { coherence: 0.1 })] })).applications.text).toBe(
      'No skin claim supported'
    );
    expect(buildAnswers(base({ claims: [] })).applications.text).toBe('No skin claim supported');
  });
});

describe('isClaimSupported', () => {
  it('needs a coherence of 0.5 or more AND at least one sub-group for the claim', () => {
    expect(isClaimSupported(claim('A', { coherence: 0.5, n_for: 1 }))).toBe(true);
    expect(isClaimSupported(claim('A', { coherence: 0.8, n_for: 0 }))).toBe(false);
    expect(isClaimSupported(claim('A', { coherence: 0.49, n_for: 5 }))).toBe(false);
    expect(isClaimSupported(claim('A', { coherence: 1, n_for: 5 }))).toBe(true);
  });
});

describe('buildAnswers — the five keys', () => {
  it('returns exactly the five answers, in reading order', () => {
    expect(Object.keys(buildAnswers(base()))).toEqual([
      'counts',
      'genes',
      'processes',
      'meaning',
      'applications',
    ]);
  });
});
