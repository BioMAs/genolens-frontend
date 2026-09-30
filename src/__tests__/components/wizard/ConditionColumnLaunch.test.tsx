/**
 * La colonne de condition choisie dans le wizard doit arriver au lancement.
 *
 * Le ContrastBuilder laisse choisir n'importe quelle colonne de la feuille
 * d'échantillons, mais ce choix n'était jamais envoyé : le pipeline R
 * reprenait sa propre liste d'alias (condition / group / treatment /
 * genotype). Une colonne `genotype_detail` faisait échouer l'analyse, et une
 * feuille qui avait aussi une colonne `condition` était comparée sur la
 * mauvaise colonne. Le choix part maintenant dans `params.condition_column`.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ContrastBuilder from '@/components/wizard/ContrastBuilder';
import StepLaunch from '@/components/wizard/steps/StepLaunch';
import { DEFAULT_DESEQ2_PARAMS } from '@/components/wizard/steps/StepAnalysisSettings';

jest.mock('@/hooks/useDatasets', () => ({ useDatasetQuery: jest.fn() }));
jest.mock('@/utils/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('@/hooks/useAnalyses', () => ({
  useCreateAnalysis: jest.fn(),
  useAnalysis: jest.fn(() => ({ data: undefined })),
}));
jest.mock('@/hooks/useProjectData', () => ({
  useProjectDatasets: jest.fn(() => ({ data: [] })),
}));
jest.mock('@/components/analyses/AnalysisQuotaNotice', () => ({
  __esModule: true,
  default: () => null,
  useAnalysisQuotaBlocked: () => false,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const { useDatasetQuery } = require('@/hooks/useDatasets');
const api = require('@/utils/api').default;
const { useCreateAnalysis } = require('@/hooks/useAnalyses');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => jest.clearAllMocks());

/** Ouvre le Select dont le déclencheur affiche `triggerText`, puis choisit `option`. */
function choose(triggerText: string, option: string) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${triggerText}`) }));
  fireEvent.click(screen.getByText(option, { selector: 'div' }));
}

// ── ContrastBuilder ──────────────────────────────────────────────────────────

describe('ContrastBuilder', () => {
  // Une colonne alias (`condition`) existe, mais les comparaisons portent sur
  // `genotype_detail` : exactement le cas que R résolvait mal.
  const sheet = {
    columns: ['sample_id', 'condition', 'genotype_detail'],
    data: [
      { sample_id: 'S1', condition: 'day1', genotype_detail: 'KO' },
      { sample_id: 'S2', condition: 'day2', genotype_detail: 'KO' },
      { sample_id: 'S3', condition: 'day1', genotype_detail: 'WT' },
      { sample_id: 'S4', condition: 'day2', genotype_detail: 'WT' },
    ],
  };

  it('hands the chosen grouping column to the wizard with the contrast file', async () => {
    useDatasetQuery.mockReturnValue({ data: sheet, isLoading: false, isError: false });
    api.post.mockResolvedValue({ data: { dataset_id: 'contrast-ds' } });
    const onBuilt = jest.fn();

    render(
      <ContrastBuilder projectId="p1" samplesDatasetId="samples-ds" samplesReady onBuilt={onBuilt} />
    );

    // Auto-détection sur l'alias, que l'utilisateur remplace.
    choose('condition', 'genotype_detail');
    choose('Test…', 'KO');
    choose('Reference…', 'WT');
    fireEvent.click(screen.getByRole('button', { name: /use these comparisons/i }));

    await waitFor(() => expect(onBuilt).toHaveBeenCalledWith('contrast-ds', 'genotype_detail'));
  });

  it('reports the auto-detected column when the user keeps it', async () => {
    useDatasetQuery.mockReturnValue({
      data: {
        columns: ['sample_id', 'groupe'],
        data: [
          { sample_id: 'S1', groupe: 'KO' },
          { sample_id: 'S2', groupe: 'WT' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    api.post.mockResolvedValue({ data: { dataset_id: 'contrast-ds' } });
    const onBuilt = jest.fn();

    render(
      <ContrastBuilder projectId="p1" samplesDatasetId="samples-ds" samplesReady onBuilt={onBuilt} />
    );

    choose('Test…', 'KO');
    choose('Reference…', 'WT');
    fireEvent.click(screen.getByRole('button', { name: /use these comparisons/i }));

    await waitFor(() => expect(onBuilt).toHaveBeenCalledWith('contrast-ds', 'groupe'));
  });
});

// ── StepLaunch ───────────────────────────────────────────────────────────────

describe('StepLaunch', () => {
  function renderLaunch(conditionColumn: string | null | undefined) {
    const mutateAsync = jest.fn().mockResolvedValue({ id: 'analysis-1' });
    useCreateAnalysis.mockReturnValue({ mutateAsync, isPending: false });
    render(
      <StepLaunch
        projectId="p1"
        analysisName="KO vs WT"
        dataType="transcriptomics"
        matrixDatasetId="matrix-ds"
        samplesDatasetId="samples-ds"
        contrastsDatasetId="contrast-ds"
        conditionColumn={conditionColumn}
        deseq2Params={{ ...DEFAULT_DESEQ2_PARAMS, species: 'mouse' }}
        analysisId={null}
        onLaunched={jest.fn()}
        onComplete={jest.fn()}
        onBack={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /launch analysis/i }));
    return mutateAsync;
  }

  it('sends the chosen condition column in the launch params', async () => {
    const mutateAsync = renderLaunch('genotype_detail');

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const payload = mutateAsync.mock.calls[0][0];
    expect(payload.params.condition_column).toBe('genotype_detail');
    // Les autres réglages ne sont pas écrasés.
    expect(payload.params.species).toBe('mouse');
    expect(payload.params.fdr).toBe(DEFAULT_DESEQ2_PARAMS.fdr);
    expect(payload.comparisons_dataset_id).toBe('contrast-ds');
  });

  it.each([null, undefined])(
    'sends a null condition column for an uploaded contrast file (%s)',
    async (conditionColumn) => {
      const mutateAsync = renderLaunch(conditionColumn);

      await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
      expect(mutateAsync.mock.calls[0][0].params.condition_column).toBeNull();
    }
  );
});
