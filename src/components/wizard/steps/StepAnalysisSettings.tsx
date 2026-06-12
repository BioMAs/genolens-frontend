'use client';

import React, { useEffect, useState } from 'react';
import { AnalysisParams } from '@/types';
import { ChevronRight, Info, Settings, Zap } from 'lucide-react';
import { useAnnoDbCategories } from '@/hooks/useAnalyses';

const MODE_KEY = 'genolens:analysis-mode';

export const DEFAULT_DESEQ2_PARAMS: AnalysisParams = {
  design:     'auto',
  fdr:        0.05,
  min_log2fc: 1.0,
  min_reads:  100_000,
  min_genes:  500,
  min_count:  10,
  min_reps:   2,
  threads:    1,
  de_method:  'all',
};

export interface ClusteringConfig {
  top_n_genes: number;
  method: 'ward' | 'complete' | 'average';
  metric: 'euclidean' | 'pearson' | 'spearman';
  cluster_rows: boolean;
  cluster_cols: boolean;
}

export const DEFAULT_CLUSTERING: ClusteringConfig = {
  top_n_genes: 500,
  method:      'ward',
  metric:      'euclidean',
  cluster_rows: true,
  cluster_cols: true,
};

export interface EnrichmentConfig {
  databases: string[] | null;  // null = all available databases
  fdr: number;
}

export const DEFAULT_ENRICHMENT: EnrichmentConfig = {
  databases: null,  // use all by default
  fdr:       0.05,
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface StepAnalysisSettingsProps {
  analysisName: string;
  deseq2Params: AnalysisParams;
  clusteringConfig: ClusteringConfig;
  enrichmentConfig: EnrichmentConfig;
  species: string;
  onChangeName:       (name: string)              => void;
  onChangeDeseq2:     (params: AnalysisParams)    => void;
  onChangeClustering: (cfg: ClusteringConfig)     => void;
  onChangeEnrichment: (cfg: EnrichmentConfig)     => void;
  onChangeSpecies:    (species: string)           => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function StepAnalysisSettings({
  analysisName,
  deseq2Params,
  clusteringConfig,
  enrichmentConfig,
  species,
  onChangeName,
  onChangeDeseq2,
  onChangeClustering,
  onChangeEnrichment,
  onChangeSpecies,
  onContinue,
  onBack,
}: StepAnalysisSettingsProps) {
  const [mode, setMode] = useState<'standard' | 'advanced'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(MODE_KEY) as 'standard' | 'advanced') ?? 'standard';
    }
    return 'standard';
  });

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const { data: annoData, isLoading: annoLoading } = useAnnoDbCategories(species || 'human', mode === 'advanced');
  const availableCategories: string[] = annoData?.categories ?? [];

  const toggleDb = (id: string) => {
    const current = enrichmentConfig.databases;
    if (current === null) {
      // Switch from "all" to just the deselected set
      onChangeEnrichment({
        ...enrichmentConfig,
        databases: availableCategories.filter(d => d !== id),
      });
    } else {
      const next = current.includes(id) ? current.filter(d => d !== id) : [...current, id];
      // If all selected, revert to null (= all)
      onChangeEnrichment({
        ...enrichmentConfig,
        databases: next.length === availableCategories.length ? null : next,
      });
    }
  };

  const selectAllDbs = () => onChangeEnrichment({ ...enrichmentConfig, databases: null });
  const clearAllDbs  = () => onChangeEnrichment({ ...enrichmentConfig, databases: [] });

  const isDbSelected = (id: string) =>
    enrichmentConfig.databases === null || enrichmentConfig.databases.includes(id);

  const canContinue = analysisName.trim().length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Analysis Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Configure how your analysis will run. You can always re-run with different settings.
        </p>
      </div>

      {/* Analysis name */}
      <div>
        <label htmlFor="analysis-name" className="block text-sm font-medium text-gray-700 mb-1">
          Analysis Name <span className="text-red-500">*</span>
        </label>
        <input
          id="analysis-name"
          type="text"
          value={analysisName}
          onChange={e => onChangeName(e.target.value)}
          placeholder="e.g. Treatment A vs Control — Batch 1"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setMode('standard')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'standard'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="h-3.5 w-3.5" />
          Standard
        </button>
        <button
          type="button"
          onClick={() => setMode('advanced')}
          className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            mode === 'advanced'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="h-3.5 w-3.5" />
          Advanced
        </button>
      </div>

      {/* Standard mode — read-only summary */}
      {mode === 'standard' && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-semibold text-indigo-800">
              Standard mode — recommended defaults will be used
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <SummaryCard
              title="Analysis"
              items={[
                `FDR threshold: ${deseq2Params.fdr}`,
                `log2FC: ${deseq2Params.min_log2fc}`,
                `Design: ${deseq2Params.design}`,
              ]}
            />
            <SummaryCard
              title="Clustering"
              items={[
                `Method: ${clusteringConfig.method}`,
                `Metric: ${clusteringConfig.metric}`,
                `Top N genes: ${clusteringConfig.top_n_genes}`,
              ]}
            />
            <div className="rounded-lg bg-white border border-indigo-100 p-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1.5">Enrichment</p>
              <ul className="space-y-0.5">
                <li className="text-xs text-gray-600">
                  <label className="block text-xs text-gray-500 mb-0.5">Species</label>
                  <SpeciesSelect value={species} onChange={onChangeSpecies} />
                </li>
                <li className="text-xs text-gray-600">
                  {`Databases: ${enrichmentConfig.databases === null ? 'All (anno.db)' : enrichmentConfig.databases.length === 0 ? 'None' : enrichmentConfig.databases.join(', ')}`}
                </li>
                <li className="text-xs text-gray-600">{`FDR: ${enrichmentConfig.fdr}`}</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-indigo-500">
            Switch to Advanced mode to customise any of these parameters.
          </p>
        </div>
      )}

      {/* Advanced mode */}
      {mode === 'advanced' && (
        <div className="space-y-4">
          {/* Analysis params */}
          <details open className="rounded-xl border border-gray-200 overflow-hidden">
            <summary className="cursor-pointer select-none bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100">
              Analysis Parameters
            </summary>
            <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField
                label="Design formula"
                value={deseq2Params.design}
                options={[
                  { value: 'auto',            label: 'Auto-detect' },
                  { value: 'condition',       label: '~ condition' },
                  { value: 'batch_condition', label: '~ batch + condition' },
                ]}
                onChange={v => onChangeDeseq2({ ...deseq2Params, design: v as AnalysisParams['design'] })}
                hint="Auto-detect works in most cases."
              />
              <NumberField
                label="FDR threshold (p-adj)"
                value={deseq2Params.fdr}
                min={0.001} max={0.2} step={0.001}
                onChange={v => onChangeDeseq2({ ...deseq2Params, fdr: v })}
                hint="Typically 0.05. Lower = more stringent."
              />
              <NumberField
                label="log2FC"
                value={deseq2Params.min_log2fc}
                min={0} max={5} step={0.1}
                onChange={v => onChangeDeseq2({ ...deseq2Params, min_log2fc: v })}
                hint="1.0 = 2× fold change minimum (identique pipe_scilicium)."
              />
              <NumberField
                label="Min reads / sample"
                value={deseq2Params.min_reads}
                min={0} max={10_000_000} step={10_000}
                onChange={v => onChangeDeseq2({ ...deseq2Params, min_reads: v })}
                hint="Samples below this are excluded."
              />
              <NumberField
                label="Min genes / sample"
                value={deseq2Params.min_genes}
                min={0} max={30_000} step={100}
                onChange={v => onChangeDeseq2({ ...deseq2Params, min_genes: v })}
              />
              <NumberField
                label="Min count (per gene)"
                value={deseq2Params.min_count}
                min={0} max={100} step={1}
                onChange={v => onChangeDeseq2({ ...deseq2Params, min_count: v })}
                hint="Genes with lower mean count are filtered."
              />
              <SelectField
                label="DEA method"
                value={deseq2Params.de_method ?? 'all'}
                options={[
                  { value: 'all',    label: 'All + Stouffer (recommended)' },
                  { value: 'deseq2', label: 'DESeq2 only' },
                  { value: 'limma',  label: 'limma-voom only' },
                  { value: 'edger',  label: 'edgeR only' },
                ]}
                onChange={v => onChangeDeseq2({ ...deseq2Params, de_method: v as AnalysisParams['de_method'] })}
                hint='"All" combines DESeq2 + edgeR + limma via Stouffer for added robustness.'
              />
            </div>
          </details>

          {/* Clustering params */}
          <details className="rounded-xl border border-gray-200 overflow-hidden">
            <summary className="cursor-pointer select-none bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100">
              Clustering Parameters
              <span className="ml-2 text-xs font-normal text-gray-400">(applied when you explore clustering after analysis)</span>
            </summary>
            <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField
                label="Top N genes"
                value={clusteringConfig.top_n_genes}
                min={50} max={5000} step={50}
                onChange={v => onChangeClustering({ ...clusteringConfig, top_n_genes: v })}
                hint="Most variable genes used for heatmap."
              />
              <SelectField
                label="Linkage method"
                value={clusteringConfig.method}
                options={[
                  { value: 'ward',     label: 'Ward' },
                  { value: 'complete', label: 'Complete' },
                  { value: 'average',  label: 'Average' },
                ]}
                onChange={v => onChangeClustering({ ...clusteringConfig, method: v as ClusteringConfig['method'] })}
              />
              <SelectField
                label="Distance metric"
                value={clusteringConfig.metric}
                options={[
                  { value: 'euclidean', label: 'Euclidean' },
                  { value: 'pearson',   label: 'Pearson correlation' },
                  { value: 'spearman',  label: 'Spearman correlation' },
                ]}
                onChange={v => onChangeClustering({ ...clusteringConfig, metric: v as ClusteringConfig['metric'] })}
              />
            </div>
          </details>

          {/* Enrichment params */}
          <details className="rounded-xl border border-gray-200 overflow-hidden">
            <summary className="cursor-pointer select-none bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-100">
              Enrichment Databases
              <span className="ml-2 text-xs font-normal text-gray-400">(applied when you explore enrichment after analysis)</span>
            </summary>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
                <span className="font-semibold shrink-0">Species:</span>
                <SpeciesSelect value={species} onChange={onChangeSpecies} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600">
                    {enrichmentConfig.databases === null
                      ? 'All available databases (anno.db)'
                      : `${enrichmentConfig.databases.length} databases selected`}
                  </p>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAllDbs}
                      className="text-xs text-indigo-600 hover:underline">
                      Select all
                    </button>
                    <button type="button" onClick={clearAllDbs}
                      className="text-xs text-gray-500 hover:underline">
                      Clear
                    </button>
                  </div>
                </div>
                {annoLoading ? (
                  <p className="text-xs text-gray-400">Loading databases...</p>
                ) : availableCategories.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    No categories found for &apos;{species}&apos;. All available databases will be used.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => toggleDb(cat)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          isDbSelected(cat)
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-300 text-gray-600 hover:border-indigo-400'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <NumberField
                label="Enrichment FDR threshold"
                value={enrichmentConfig.fdr}
                min={0.001} max={0.2} step={0.001}
                onChange={v => onChangeEnrichment({ ...enrichmentConfig, fdr: v })}
                hint="Adjusted p-value cutoff for enriched terms."
              />
            </div>
          </details>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Review & Launch
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Small field components ───────────────────────────────────────────────────
function SummaryCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg bg-white border border-indigo-100 p-3">
      <p className="text-xs font-semibold text-indigo-700 mb-1.5">{title}</p>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-gray-600">{item}</li>
        ))}
      </ul>
    </div>
  );
}

function SelectField({
  label, value, options, onChange, hint,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

function NumberField({
  label, value, min, max, step, onChange, hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {hint && <p className="mt-0.5 text-[10px] text-gray-400">{hint}</p>}
    </div>
  );
}

const SPECIES_OPTIONS = [
  { value: 'human',     label: 'Homo sapiens (Human)' },
  { value: 'mouse',     label: 'Mus musculus (Mouse)' },
  { value: 'rat',       label: 'Rattus norvegicus (Rat)' },
  { value: 'zebrafish', label: 'Danio rerio (Zebrafish)' },
  { value: 'pig',       label: 'Sus scrofa (Pig)' },
];

function SpeciesSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value || 'human'}
      onChange={e => onChange(e.target.value)}
      className="rounded-md border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    >
      {SPECIES_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
