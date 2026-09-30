import type { AnalysisParams } from '@/types';
import type { EnrichmentConfig } from './steps/StepAnalysisSettings';

/**
 * The `params` of `POST /analyses`, assembled from the wizard's separate settings.
 *
 * The enrichment settings live apart from the DESeq2 ones, and only the databases used to be
 * merged in: the "Enrichment FDR threshold" field was edited, summarised on screen, and never
 * sent, so every analysis kept its terms at 0.05. `enrichment_fdr` is the term cut-off (R
 * `--padj-cutoff`); `fdr` stays the DEG threshold.
 */
export function buildLaunchParams(
  deseq2Params: AnalysisParams,
  enrichmentConfig: EnrichmentConfig,
  species: string,
): AnalysisParams {
  return {
    ...deseq2Params,
    enrichment_databases: enrichmentConfig.databases,
    enrichment_fdr: enrichmentConfig.fdr,
    species,
  };
}
