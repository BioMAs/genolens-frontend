'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAnnoDbCategories } from '@/hooks/useAnalyses';
import { AnalysisParams } from '@/types';
import api from '@/utils/api';

interface Props {
  projectId: string;
}

const DEFAULT_PARAMS: AnalysisParams = {
  design: 'auto',
  fdr: 0.05,
  min_log2fc: 1.0,
  min_reads: 100_000,
  min_genes: 500,
  min_count: 10,
  min_reps: 2,
  threads: 1,
};

export default function AnalysisLauncher({ projectId }: Props) {
  const router = useRouter();

  const [species, setSpecies] = useState('human');
  const { data: annoData, isLoading: annoLoading } = useAnnoDbCategories(species);
  const availableCategories: string[] = annoData?.categories ?? [];

  const [name, setName] = useState('');
  const [params, setParams] = useState<AnalysisParams>({ ...DEFAULT_PARAMS });
  const [enrichmentDatabases, setEnrichmentDatabases] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const countsRef = useRef<HTMLInputElement>(null);
  const samplesRef = useRef<HTMLInputElement>(null);
  const comparisonsRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError('A name is required.'); return; }
    if (!countsRef.current?.files?.[0]) { setError('Select a count matrix file.'); return; }
    if (!samplesRef.current?.files?.[0]) { setError('Select a samples metadata file.'); return; }
    if (!comparisonsRef.current?.files?.[0]) { setError('Select a comparisons file.'); return; }

    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('name', name.trim());
    formData.append('params_json', JSON.stringify({
      ...params,
      species,
      enrichment_databases: enrichmentDatabases,
    }));
    formData.append('counts_file', countsRef.current.files[0]);
    formData.append('samples_file', samplesRef.current.files[0]);
    formData.append('comparisons_file', comparisonsRef.current.files[0]);

    try {
      setIsPending(true);
      const res = await api.post('/analyses/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const analysisId: string = res.data?.id;
      if (analysisId) {
        router.push(`/projects/${projectId}/analyses/${analysisId}`);
      } else {
        router.push(`/projects/${projectId}/analyses`);
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? err?.message ?? 'Launch failed.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* Analysis name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Analysis name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Treatment A vs Control — Batch 1"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* File uploads */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FileInput
          label="Count matrix"
          hint="TSV/CSV — gene_id + sample columns"
          inputRef={countsRef}
          required
        />
        <FileInput
          label="Sample metadata"
          hint="TSV/CSV — sample_id, condition"
          inputRef={samplesRef}
          required
        />
        <FileInput
          label="Comparisons"
          hint="TSV/CSV — comparison_id, condition1, condition2"
          inputRef={comparisonsRef}
          required
        />
      </div>

      {/* Analysis parameters */}
      <details className="rounded-md border border-gray-200 p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700 select-none">
          Advanced parameters
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <ParamSelect
            label="Design"
            value={params.design}
            onChange={(v) => setParams((p) => ({ ...p, design: v as AnalysisParams['design'] }))}
            options={[
              { value: 'auto', label: 'Auto (recommended)' },
              { value: 'condition', label: '~ condition' },
              { value: 'batch_condition', label: '~ batch + condition' },
            ]}
          />
          <NumberParam
            label="FDR"
            value={params.fdr}
            step={0.01}
            min={0.001}
            max={0.2}
            onChange={(v) => setParams((p) => ({ ...p, fdr: v }))}
          />
          <NumberParam
            label="Min |log2FC|"
            value={params.min_log2fc}
            step={0.1}
            min={0}
            max={5}
            onChange={(v) => setParams((p) => ({ ...p, min_log2fc: v }))}
          />
          <NumberParam
            label="Min reads / sample"
            value={params.min_reads}
            step={10000}
            min={0}
            max={10_000_000}
            onChange={(v) => setParams((p) => ({ ...p, min_reads: v }))}
          />
          <NumberParam
            label="Min genes / sample"
            value={params.min_genes}
            step={100}
            min={0}
            max={30_000}
            onChange={(v) => setParams((p) => ({ ...p, min_genes: v }))}
          />
          <NumberParam
            label="Min count"
            value={params.min_count}
            step={1}
            min={0}
            max={100}
            onChange={(v) => setParams((p) => ({ ...p, min_count: v }))}
          />
        </div>

        {/* Enrichment database selection */}
        <div className="mt-4 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">
              Enrichment databases
            </p>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500 shrink-0">Species:</label>
              <select
                value={species}
                onChange={e => setSpecies(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="human">Homo sapiens (Human)</option>
                <option value="mouse">Mus musculus (Mouse)</option>
                <option value="rat">Rattus norvegicus (Rat)</option>
                <option value="zebrafish">Danio rerio (Zebrafish)</option>
                <option value="pig">Sus scrofa (Pig)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEnrichmentDatabases(null)}
                className="text-xs text-indigo-600 hover:underline">Select all</button>
              <button type="button" onClick={() => setEnrichmentDatabases([])}
                className="text-xs text-gray-500 hover:underline">Clear</button>
            </div>
          </div>
          {annoLoading ? (
            <p className="text-xs text-gray-400">Loading databases...</p>
          ) : availableCategories.length === 0 ? (
            <p className="text-xs text-gray-400">All available databases will be used.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(cat => {
                const selected = enrichmentDatabases === null || enrichmentDatabases.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (enrichmentDatabases === null) {
                        setEnrichmentDatabases(availableCategories.filter(d => d !== cat));
                      } else {
                        const next = selected
                          ? enrichmentDatabases.filter(d => d !== cat)
                          : [...enrichmentDatabases, cat];
                        setEnrichmentDatabases(next.length === availableCategories.length ? null : next);
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </details>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Launching…' : 'Launch analysis'}
      </button>
    </form>
  );
}

// ---- Sub-components --------------------------------------------------------

function FileInput({
  label,
  hint,
  inputRef,
  required,
}: {
  label: string;
  hint: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  required?: boolean;
}) {
  const [fileName, setFileName] = useState<string>('');
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50 hover:bg-indigo-50">
        <span className="text-xs text-gray-500 text-center px-2">
          {fileName ? (
            <span className="text-indigo-700 font-medium">{fileName}</span>
          ) : (
            <>Click or drag</>
          )}
        </span>
        <span className="text-xs text-gray-400 mt-0.5">{hint}</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx"
          className="hidden"
          ref={inputRef}
          required={required}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
        />
      </label>
    </div>
  );
}

function ParamSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberParam({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}


