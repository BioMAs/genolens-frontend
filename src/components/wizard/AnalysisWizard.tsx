'use client';

import React, { useState } from 'react';
import WizardStepBar from './WizardStepBar';
import StepDataType, { DataType } from './steps/StepDataType';
import StepUploadFiles from './steps/StepUploadFiles';
import StepDataValidation from './steps/StepDataValidation';
import StepAnalysisSettings, {
  DEFAULT_DESEQ2_PARAMS,
  DEFAULT_CLUSTERING,
  DEFAULT_ENRICHMENT,
  ClusteringConfig,
  EnrichmentConfig,
} from './steps/StepAnalysisSettings';
import StepLaunch from './steps/StepLaunch';
import StepResults from './steps/StepResults';
import { buildLaunchParams } from './launchParams';
import { AnalysisParams } from '@/types';
import { useProjectSummary } from '@/hooks/useProjectData';
import { PageHeader } from '@/components/ui/page-header';

// ─── Wizard State ──────────────────────────────────────────────────────────────
interface WizardState {
  // Step 1
  matrixDatasetId:    string | null;
  samplesDatasetId:   string | null;
  contrastsDatasetId: string | null;
  /** Sample-sheet column the built comparisons use; null for an uploaded contrast file. */
  conditionColumn:    string | null;
  // Step 3
  analysisName:       string;
  species:            string;
  deseq2Params:       AnalysisParams;
  clusteringConfig:   ClusteringConfig;
  enrichmentConfig:   EnrichmentConfig;
  // Step 4
  launchedAnalysisId: string | null;
}

const INITIAL_STATE: WizardState = {
  matrixDatasetId:    null,
  samplesDatasetId:   null,
  contrastsDatasetId: null,
  conditionColumn:    null,
  analysisName:      '',
  species:            'human',
  deseq2Params:       { ...DEFAULT_DESEQ2_PARAMS },
  clusteringConfig:   { ...DEFAULT_CLUSTERING },
  enrichmentConfig:   { ...DEFAULT_ENRICHMENT },
  launchedAnalysisId: null,
};

// ─── Props ─────────────────────────────────────────────────────────────────────
interface AnalysisWizardProps {
  projectId: string;
}

export default function AnalysisWizard({ projectId }: AnalysisWizardProps) {
  const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const { data: summary } = useProjectSummary(projectId);

  const projectName = summary?.project?.name ?? 'Project';

  const patchState = (patch: Partial<WizardState>) =>
    setState(prev => ({ ...prev, ...patch }));

  // ── Step 1 handlers ──────────────────────────────────────────────────────────
  const handleUploadComplete = (ids: {
    matrixDatasetId: string;
    samplesDatasetId: string;
    contrastsDatasetId: string;
    conditionColumn: string | null;
  }) => {
    patchState(ids);
    setCurrentStep(2);
  };

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const goTo = (step: number) => setCurrentStep(step);

  // ── Reset for "Run New Analysis" ─────────────────────────────────────────────
  const handleRunNew = () => {
    setState(INITIAL_STATE);
    setSelectedDataType(null);
    setCurrentStep(1);
  };

  return (
    /* `py-8 px-4 sm:px-6 lg:px-8` + `mx-auto max-w-4xl` : deux enveloppes
       imbriquees qui refaisaient a la main ce que `.page-container` porte, avec
       leurs propres gouttieres et leur propre largeur. */
    <div className="page-container" data-measure="prose">
      <div>
        <PageHeader
          title="New Analysis"
          description={
            selectedDataType
              ? 'Follow the steps below to configure and launch your transcriptomics analysis.'
              : 'Select a data type to get started.'
          }
          crumbs={[
            { label: 'Projects', href: '/projects' },
            { label: projectName, href: `/projects/${projectId}` },
            { label: 'New analysis' },
          ]}
        />

        {/* Data type selection (pre-wizard) */}
        {!selectedDataType && (
          <div className="rounded-card bg-surface p-6 sm:p-8 shadow-sm">
            <StepDataType onSelect={setSelectedDataType} />
          </div>
        )}

        {/* Step bar + step content (shown after data type is selected) */}
        {selectedDataType && (
          <>
            {/* Step bar */}
            <WizardStepBar currentStep={currentStep} />

            {/* Step content */}
            <div className="rounded-card bg-surface p-6 sm:p-8 shadow-sm">
              {currentStep === 1 && (
                <StepUploadFiles
                  projectId={projectId}
                  matrixDatasetId={state.matrixDatasetId}
                  samplesDatasetId={state.samplesDatasetId}
                  contrastsDatasetId={state.contrastsDatasetId}
                  conditionColumn={state.conditionColumn}
                  onComplete={handleUploadComplete}
                />
              )}

              {currentStep === 2 && state.matrixDatasetId && state.samplesDatasetId && (
                <StepDataValidation
                  projectId={projectId}
                  matrixDatasetId={state.matrixDatasetId}
                  samplesDatasetId={state.samplesDatasetId}
                  conditionColumn={state.conditionColumn}
                  onContinue={() => goTo(3)}
                  onBack={() => goTo(1)}
                />
              )}

              {currentStep === 3 && (
                <StepAnalysisSettings
                  analysisName={state.analysisName}
                  deseq2Params={state.deseq2Params}
                  clusteringConfig={state.clusteringConfig}
                  enrichmentConfig={state.enrichmentConfig}
                  species={state.species}
                  onChangeName={name => patchState({ analysisName: name })}
                  onChangeDeseq2={params => patchState({ deseq2Params: params })}
                  onChangeClustering={cfg => patchState({ clusteringConfig: cfg })}
                  onChangeEnrichment={cfg => patchState({ enrichmentConfig: cfg })}
                  onChangeSpecies={s => patchState({ species: s })}
                  onContinue={() => goTo(4)}
                  onBack={() => goTo(2)}
                />
              )}

              {currentStep === 4 &&
                state.matrixDatasetId &&
                state.samplesDatasetId &&
                state.contrastsDatasetId && (
                  <StepLaunch
                    projectId={projectId}
                    analysisName={state.analysisName}
                    dataType={selectedDataType!}
                    matrixDatasetId={state.matrixDatasetId}
                    samplesDatasetId={state.samplesDatasetId}
                    contrastsDatasetId={state.contrastsDatasetId}
                    conditionColumn={state.conditionColumn}
                    deseq2Params={buildLaunchParams(state.deseq2Params, state.enrichmentConfig, state.species)}
                    analysisId={state.launchedAnalysisId}
                    onLaunched={id => patchState({ launchedAnalysisId: id })}
                    onComplete={id => { patchState({ launchedAnalysisId: id }); goTo(5); }}
                    onBack={() => goTo(3)}
                  />
                )}

              {currentStep === 5 &&
                state.launchedAnalysisId &&
                state.matrixDatasetId && (
                  <StepResults
                    projectId={projectId}
                    analysisId={state.launchedAnalysisId}
                    matrixDatasetId={state.matrixDatasetId}
                    clusteringConfig={state.clusteringConfig}
                    onRunNew={handleRunNew}
                  />
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
