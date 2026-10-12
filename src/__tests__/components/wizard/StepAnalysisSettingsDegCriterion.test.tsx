/**
 * How the wizard decides which genes are DEGs, and which genes it keeps.
 *
 * - The low-count filter defaults to `min_reps: 'auto'`: a gene must reach the min count in as
 *   many samples as the smallest compared group (edgeR::filterByExpr). The old fixed 2 kept genes
 *   carried by two samples only.
 * - With "All three methods", DESeq2 decides; edgeR and limma (and their Stouffer combination)
 *   only show concordance. The control no longer advertises Stouffer as the recommended choice.
 */
import { fireEvent, render, screen } from '@testing-library/react';

import StepAnalysisSettings, {
  DEFAULT_CLUSTERING,
  DEFAULT_DESEQ2_PARAMS,
  DEFAULT_ENRICHMENT,
} from '@/components/wizard/steps/StepAnalysisSettings';
import { buildLaunchParams } from '@/components/wizard/launchParams';
import { formatMinReps } from '@/utils/formatters';

jest.mock('@/hooks/useAnalyses', () => ({
  useAnnoDbCategories: jest.fn(() => ({ data: { categories: [] }, isLoading: false })),
}));

function renderAdvanced(onChangeDeseq2 = jest.fn()) {
  localStorage.setItem('genolens:analysis-mode', 'advanced');
  render(
    <StepAnalysisSettings
      analysisName="Test"
      deseq2Params={DEFAULT_DESEQ2_PARAMS}
      clusteringConfig={DEFAULT_CLUSTERING}
      enrichmentConfig={DEFAULT_ENRICHMENT}
      species="human"
      onChangeName={jest.fn()}
      onChangeDeseq2={onChangeDeseq2}
      onChangeClustering={jest.fn()}
      onChangeEnrichment={jest.fn()}
      onChangeSpecies={jest.fn()}
      onContinue={jest.fn()}
      onBack={jest.fn()}
    />,
  );
  return onChangeDeseq2;
}

afterEach(() => localStorage.clear());

describe('wizard defaults', () => {
  it('filters low counts on the smallest compared group', () => {
    expect(DEFAULT_DESEQ2_PARAMS.min_reps).toBe('auto');
  });

  it('sends min_reps auto with the analysis', () => {
    expect(buildLaunchParams(DEFAULT_DESEQ2_PARAMS, DEFAULT_ENRICHMENT, 'human').min_reps).toBe('auto');
  });
});

describe('advanced settings', () => {
  it('lets the user switch the sample requirement between auto and a fixed number', () => {
    const onChange = renderAdvanced();
    const select = screen.getByDisplayValue(/smallest compared group/i);

    fireEvent.change(select, { target: { value: '3' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ min_reps: 3 }));

    fireEvent.change(select, { target: { value: 'auto' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ min_reps: 'auto' }));
  });

  it('presents DESeq2 as the method that decides', () => {
    renderAdvanced();
    expect(screen.getByDisplayValue(/DESeq2 decides/)).toBeInTheDocument();
    expect(screen.queryByText(/All \+ Stouffer/)).not.toBeInTheDocument();
  });
});

describe('formatMinReps', () => {
  it('reads a run resolved from auto', () => {
    expect(formatMinReps(3, 'auto')).toBe('3 (auto: smallest compared group)');
  });

  it('reads params that were never resolved', () => {
    expect(formatMinReps('auto')).toBe('Auto (smallest compared group)');
  });

  it('reads a fixed number, and the old default when absent', () => {
    expect(formatMinReps(4, 'fixed')).toBe('4');
    expect(formatMinReps(undefined)).toBe('2');
  });
});
