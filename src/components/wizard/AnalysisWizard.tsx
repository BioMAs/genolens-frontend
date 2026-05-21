'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import WizardStepBar from './WizardStepBar';
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
import { AnalysisParams } from '@/types';
import { useProjectSummary } from '@/hooks/useProjectData';

// ─── Wizard State ──────────────────────────────────────────────────────────────
interface WizardState {
  // Step 1
  matrixDatasetId:    string | null;
  samplesDatasetId:   string | null;
  contrastsDatasetId: string | null;
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
  analysisName:       '',
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
  }) => {
    patchState(ids);
    setCurrentStep(2);
  };

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const goTo = (step: number) => setCurrentStep(step);

  // ── Reset for "Run New Analysis" ─────────────────────────────────────────────
  const handleRunNew = () => {
    setState(INITIAL_STATE);
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* Back link */}
        <Link
          href={`/projects/${projectId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {projectName}
        </Link>

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">New Analysis</h1>
          <p className="mt-1 text-sm text-gray-500">
            Follow the steps below to configure and launch your transcriptomics analysis.
          </p>
        </div>

        {/* Step bar */}
        <WizardStepBar currentStep={currentStep} />

        {/* Step content */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
          {currentStep === 1 && (
            <StepUploadFiles
              projectId={projectId}
              matrixDatasetId={state.matrixDatasetId}
              samplesDatasetId={state.samplesDatasetId}
              contrastsDatasetId={state.contrastsDatasetId}
              onComplete={handleUploadComplete}
            />
          )}

          {currentStep === 2 && state.matrixDatasetId && state.samplesDatasetId && (
            <StepDataValidation
              projectId={projectId}
              matrixDatasetId={state.matrixDatasetId}
              samplesDatasetId={state.samplesDatasetId}
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
                matrixDatasetId={state.matrixDatasetId}
                samplesDatasetId={state.samplesDatasetId}
                contrastsDatasetId={state.contrastsDatasetId}
                deseq2Params={{ ...state.deseq2Params, enrichment_databases: state.enrichmentConfig.databases, species: state.species }}
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
                enrichmentConfig={state.enrichmentConfig}
                onRunNew={handleRunNew}
              />
            )}
        </div>
      </div>
    </div>
  );
}
