'use client';

import React, { useCallback, useRef, useState } from 'react';
import { useProjectDatasets } from '@/hooks/useProjectData';
import { Dataset, DatasetType, DatasetStatus } from '@/types';
import api from '@/utils/api';
import {
  Upload, CheckCircle, Clock, AlertCircle, FileText, ChevronRight,
} from 'lucide-react';

// ─── Sub-step config ────────────────────────────────────────────────────────
interface SubStepConfig {
  key: 'matrix' | 'samples' | 'contrasts';
  label: string;
  description: string;
  hint: string;
  type: DatasetType;
  datasetName: string;
}

const SUB_STEPS: SubStepConfig[] = [
  {
    key: 'matrix',
    label: 'Count Matrix',
    description: 'Gene expression count matrix',
    hint: 'Rows = genes, columns = samples. Accepted: CSV, TSV, XLSX.',
    type: DatasetType.MATRIX,
    datasetName: 'Count Matrix',
  },
  {
    key: 'samples',
    label: 'Sample Metadata',
    description: 'Sample group annotations',
    hint: 'Must contain a column matching your sample names and a group/condition column.',
    type: DatasetType.METADATA_SAMPLE,
    datasetName: 'Sample Metadata',
  },
  {
    key: 'contrasts',
    label: 'Contrast File',
    description: 'Groups to compare (e.g. Treatment vs Control)',
    hint: 'Two columns: group1 and group2. Each row = one comparison.',
    type: DatasetType.METADATA_CONTRAST,
    datasetName: 'Contrast File',
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────
interface StepUploadFilesProps {
  projectId: string;
  /** IDs of already-uploaded datasets passed in from wizard state */
  matrixDatasetId: string | null;
  samplesDatasetId: string | null;
  contrastsDatasetId: string | null;
  onComplete: (ids: { matrixDatasetId: string; samplesDatasetId: string; contrastsDatasetId: string }) => void;
}

// ─── Upload card for a single sub-step ───────────────────────────────────────
interface UploadCardProps {
  config: SubStepConfig;
  dataset: Dataset | undefined;
  isActive: boolean;
  onUploaded: (dataset: Dataset) => void;
}

function UploadCard({ config, dataset, isActive, onUploaded }: UploadCardProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXT = ['.csv', '.tsv', '.txt', '.xlsx', '.xls'];

  const uploadFile = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported file type. Use: ${ALLOWED_EXT.join(', ')}`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', config.datasetName);
      form.append('dataset_type', config.type);
      const res = await api.post<Dataset>('/datasets/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUploaded(res.data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
        : typeof detail === 'string'
          ? detail
          : 'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [config, onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const status = dataset?.status;

  if (status === DatasetStatus.READY) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-800">{config.label}</p>
          <p className="text-xs text-green-600 truncate">{dataset?.name}</p>
        </div>
      </div>
    );
  }

  if (status === DatasetStatus.PROCESSING || status === DatasetStatus.PENDING) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Clock className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">{config.label}</p>
          <p className="text-xs text-blue-600">Processing… this may take a moment.</p>
        </div>
      </div>
    );
  }

  if (status === DatasetStatus.FAILED) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-red-800">{config.label} — failed</p>
          <p className="text-xs text-red-600">{dataset?.error_message ?? 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  // Not uploaded yet
  return (
    <div
      className={`rounded-lg border-2 transition-colors ${
        isActive
          ? dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-dashed border-indigo-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
          : 'border-dashed border-gray-200 bg-gray-50 opacity-60'
      } p-5`}
      onDragOver={(e) => { if (isActive) { e.preventDefault(); setDragging(true); }}}
      onDragLeave={() => setDragging(false)}
      onDrop={isActive ? handleDrop : undefined}
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className={`rounded-full p-2 ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          {uploading
            ? <Clock className="h-5 w-5 text-indigo-400 animate-spin" />
            : <Upload className={`h-5 w-5 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />}
        </div>
        <div>
          <p className={`text-sm font-semibold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
            {config.label}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
        </div>
        {isActive && !uploading && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Choose file
            </button>
            <p className="text-[10px] text-gray-400">{config.hint}</p>
          </>
        )}
        {uploading && <p className="text-xs text-indigo-500">Uploading…</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

// ─── Main step component ──────────────────────────────────────────────────────
export default function StepUploadFiles({
  projectId,
  matrixDatasetId,
  samplesDatasetId,
  contrastsDatasetId,
  onComplete,
}: StepUploadFilesProps) {
  const { data: datasets = [], refetch } = useProjectDatasets(projectId);

  // Track newly uploaded dataset IDs (override wizard state when re-uploading)
  const [localMatrix,    setLocalMatrix]    = useState<string | null>(matrixDatasetId);
  const [localSamples,   setLocalSamples]   = useState<string | null>(samplesDatasetId);
  const [localContrasts, setLocalContrasts] = useState<string | null>(contrastsDatasetId);

  const getDataset = (id: string | null) =>
    id ? datasets.find(d => d.id === id) : undefined;

  const matrixDs    = getDataset(localMatrix);
  const samplesDs   = getDataset(localSamples);
  const contrastsDs = getDataset(localContrasts);

  const allReady = (
    matrixDs?.status    === DatasetStatus.READY &&
    samplesDs?.status   === DatasetStatus.READY &&
    contrastsDs?.status === DatasetStatus.READY
  );

  const activeSubStep = !localMatrix ? 0 : !localSamples ? 1 : !localContrasts ? 2 : -1;

  const handleUploaded = (key: 'matrix' | 'samples' | 'contrasts') => (datasetId: string) => {
    if (key === 'matrix')    setLocalMatrix(datasetId);
    if (key === 'samples')   setLocalSamples(datasetId);
    if (key === 'contrasts') setLocalContrasts(datasetId);
    refetch();
  };

  // Also need to upload with project_id — wrap the API call
  const uploadForProject = (config: SubStepConfig) => async (datasetId: string) => {
    handleUploaded(config.key)(datasetId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Upload your data files</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload all three required files. Each file is validated automatically before you proceed.
        </p>
      </div>

      {/* Upload cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {SUB_STEPS.map((config, idx) => {
          const datasetId = idx === 0 ? localMatrix : idx === 1 ? localSamples : localContrasts;
          const dataset   = getDataset(datasetId);
          return (
            <UploadCardWithProjectId
              key={config.key}
              config={config}
              projectId={projectId}
              dataset={dataset}
              isActive={idx <= activeSubStep || !!datasetId}
              onUploaded={handleUploaded(config.key)}
            />
          );
        })}
      </div>

      {/* File format reference */}
      <details className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-gray-600 select-none">
          <FileText className="inline h-4 w-4 mr-1.5 text-gray-400" />
          File format reference
        </summary>
        <div className="mt-3 space-y-3 text-xs text-gray-500">
          <div>
            <p className="font-semibold text-gray-700">Count Matrix (CSV/TSV)</p>
            <pre className="mt-1 rounded bg-white border border-gray-200 p-2 overflow-x-auto">
{`gene_id,Sample_A1,Sample_A2,Sample_B1,Sample_B2
ENSG000001,42,38,120,130
ENSG000002,5,8,3,4`}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Sample Metadata (CSV/TSV)</p>
            <pre className="mt-1 rounded bg-white border border-gray-200 p-2 overflow-x-auto">
{`sample,condition,batch
Sample_A1,Control,1
Sample_A2,Control,1
Sample_B1,Treatment,2
Sample_B2,Treatment,2`}
            </pre>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Contrast File (CSV/TSV)</p>
            <pre className="mt-1 rounded bg-white border border-gray-200 p-2 overflow-x-auto">
{`group1,group2
Treatment,Control`}
            </pre>
          </div>
        </div>
      </details>

      {/* Continue button */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!allReady}
          onClick={() => {
            if (localMatrix && localSamples && localContrasts) {
              onComplete({
                matrixDatasetId: localMatrix,
                samplesDatasetId: localSamples,
                contrastsDatasetId: localContrasts,
              });
            }
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue to Data Validation
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Wrapper that injects projectId into the upload API call
function UploadCardWithProjectId({
  config,
  projectId,
  dataset,
  isActive,
  onUploaded,
}: {
  config: SubStepConfig;
  projectId: string;
  dataset: Dataset | undefined;
  isActive: boolean;
  onUploaded: (datasetId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_EXT = ['.csv', '.tsv', '.txt', '.xlsx', '.xls'];

  const uploadFile = useCallback(async (file: File) => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported file type. Use: ${ALLOWED_EXT.join(', ')}`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('name', config.datasetName);
      form.append('dataset_type', config.type);
      form.append('project_id', projectId);
      const res = await api.post<{ dataset_id: string; message: string; status: string }>(
        '/datasets/upload',
        form,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      onUploaded(res.data.dataset_id);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
        : typeof detail === 'string'
          ? detail
          : 'Upload failed. Please try again.';
      setError(msg);
    } finally {
      setUploading(false);
    }
  }, [config, projectId, onUploaded]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const status = dataset?.status;

  if (status === DatasetStatus.READY) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-800">{config.label}</p>
          <p className="text-xs text-green-600 truncate">{dataset?.name}</p>
          <button
            type="button"
            className="mt-1 text-[10px] text-green-600 underline"
            onClick={() => inputRef.current?.click()}
          >
            Replace file
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  if (status === DatasetStatus.PROCESSING || status === DatasetStatus.PENDING) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
        <Clock className="h-5 w-5 text-blue-400 animate-spin shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">{config.label}</p>
          <p className="text-xs text-blue-600">Processing… this may take a moment.</p>
        </div>
      </div>
    );
  }

  if (status === DatasetStatus.FAILED) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">{config.label} — processing failed</p>
            <p className="text-xs text-red-600">{dataset?.error_message ?? 'Unknown error'}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="self-start rounded-md bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
        >
          Try a different file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    );
  }

  // Not uploaded yet
  return (
    <div
      className={`rounded-lg border-2 transition-colors ${
        isActive
          ? dragging
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-dashed border-indigo-300 bg-white hover:border-indigo-400 hover:bg-indigo-50/40'
          : 'border-dashed border-gray-200 bg-gray-50 opacity-60 pointer-events-none'
      } p-5`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className={`rounded-full p-2 ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
          {uploading
            ? <Clock className="h-5 w-5 text-indigo-400 animate-spin" />
            : <Upload className={`h-5 w-5 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} />}
        </div>
        <div>
          <p className={`text-sm font-semibold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
            {config.label}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{config.description}</p>
        </div>
        {isActive && !uploading && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Choose file
            </button>
            <p className="text-[10px] text-gray-400">{config.hint}</p>
          </>
        )}
        {uploading && <p className="text-xs text-indigo-500">Uploading…</p>}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xlsx,.xls"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}
