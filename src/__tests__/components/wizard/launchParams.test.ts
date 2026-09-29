/**
 * The wizard's "Enrichment FDR threshold" is sent with the analysis.
 *
 * It used to be edited, summarised on screen and dropped: only the databases were merged into
 * the launch params, so every analysis kept its enriched terms at 0.05.
 */
import { buildLaunchParams } from '@/components/wizard/launchParams';
import {
  DEFAULT_DESEQ2_PARAMS,
  DEFAULT_ENRICHMENT,
} from '@/components/wizard/steps/StepAnalysisSettings';

describe('buildLaunchParams', () => {
  it('sends the enrichment FDR as the term cut-off', () => {
    const params = buildLaunchParams(DEFAULT_DESEQ2_PARAMS, { ...DEFAULT_ENRICHMENT, fdr: 0.01 }, 'human');
    expect(params.enrichment_fdr).toBe(0.01);
  });

  // `fdr` selects the DEGs; the enrichment cut-off must not overwrite it.
  it('keeps the DEG thresholds apart', () => {
    const params = buildLaunchParams(
      { ...DEFAULT_DESEQ2_PARAMS, fdr: 0.1 },
      { ...DEFAULT_ENRICHMENT, fdr: 0.01 },
      'human',
    );
    expect(params.fdr).toBe(0.1);
    expect(params.min_log2fc).toBe(DEFAULT_DESEQ2_PARAMS.min_log2fc);
  });

  it('still carries the databases and the species', () => {
    const params = buildLaunchParams(
      DEFAULT_DESEQ2_PARAMS,
      { databases: ['GO_BP', 'KEGG'], fdr: 0.05 },
      'mouse',
    );
    expect(params.enrichment_databases).toEqual(['GO_BP', 'KEGG']);
    expect(params.species).toBe('mouse');
  });

  it('sends the 0.05 default when the field is left alone', () => {
    expect(buildLaunchParams(DEFAULT_DESEQ2_PARAMS, DEFAULT_ENRICHMENT, 'human').enrichment_fdr).toBe(0.05);
  });
});
