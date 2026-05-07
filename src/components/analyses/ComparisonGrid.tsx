'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TrendingUp, TrendingDown, BarChart2, ChevronDown, ChevronUp, Settings, Play, Loader2, AlertCircle } from 'lucide-react';
import { ComparisonSummary } from '@/hooks/useProjectData';
import ClusteringAnalysis from '@/components/analysis/ClusteringAnalysis';
import EnrichmentAnalysis from '@/components/analysis/EnrichmentAnalysis';
import api from '@/utils/api';

interface ComparisonGridProps {
  projectId: string;
  analysisId?: string;
  comparisons: ComparisonSummary[];
  matrixDatasetId?: string | null;
}

export default function ComparisonGrid({ projectId, analysisId, comparisons, matrixDatasetId }: ComparisonGridProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-400">No comparisons available for this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comparisons.map((comp) => (
        <ComparisonCard
          key={comp.name}
          projectId={projectId}
          analysisId={analysisId}
          comparison={comp}
          matrixDatasetId={matrixDatasetId}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface ComparisonCardProps {
  projectId: string;
  analysisId?: string;
  comparison: ComparisonSummary;
  matrixDatasetId?: string | null;
}

type CardSection = 'none' | 'stats' | 'clustering' | 'enrichment' | 'legacy_enrichment';

function ComparisonCard({ projectId, analysisId, comparison, matrixDatasetId }: ComparisonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<CardSection>('none');

  // Statistical filter state (client-side re-filtering)
  const [fdrThreshold, setFdrThreshold] = useState<number>(0.05);
  const [log2fcThreshold, setLog2fcThreshold] = useState<number>(1.0);

  // Enrichment launch state
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState<string | null>(null);
  const [enrichmentLaunched, setEnrichmentLaunched] = useState(false);
  const [enrichDatabases, setEnrichDatabases] = useState<string[]>(['GO:BP', 'GO:MF', 'KEGG']);

  // Legacy enrichment state
  const [legacyEnrichData, setLegacyEnrichData] = useState<any[] | null>(null);
  const [legacyEnrichTotal, setLegacyEnrichTotal] = useState(0);
  const [legacyEnrichPage, setLegacyEnrichPage] = useState(1);
  const [legacyEnrichCategories, setLegacyEnrichCategories] = useState<string[]>([]);
  const [legacyEnrichCategory, setLegacyEnrichCategory] = useState<string>('');
  const [legacyEnrichLoading, setLegacyEnrichLoading] = useState(false);
  const [legacyEnrichError, setLegacyEnrichError] = useState<string | null>(null);
  const PAGE_SIZE = 50;

  // Check if GO enrichment pathways already exist in DB when enrichment section is first opened
  useEffect(() => {
    if (activeSection !== 'enrichment') return;
    if (comparison.has_enrichment || enrichmentLaunched) return;
    const checkExisting = async () => {
      try {
        const res = await api.get(
          `/datasets/${comparison.dataset_id}/comparisons/${encodeURIComponent(comparison.name)}/enrichment-pathways`
        );
        if (res.data && (Array.isArray(res.data) ? res.data.length > 0 : res.data.total > 0)) {
          setEnrichmentLaunched(true);
        }
      } catch {
        // 404 or empty = no existing pathways
      }
    };
    checkExisting();
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = useCallback(
    (section: CardSection) => {
      if (!expanded) setExpanded(true);
      setActiveSection((prev) => (prev === section ? 'none' : section));
    },
    [expanded]
  );

  const loadLegacyEnrichment = async (page = 1, category = '') => {
    if (!analysisId) return;
    setLegacyEnrichLoading(true);
    setLegacyEnrichError(null);
    try {
      const params: Record<string, any> = { page, page_size: PAGE_SIZE };
      if (category) params.category = category;
      const res = await api.get(
        `/analyses/${analysisId}/comparisons/${encodeURIComponent(comparison.name)}/legacy-enrichment`,
        { params }
      );
      setLegacyEnrichData(res.data.items ?? []);
      setLegacyEnrichTotal(res.data.total ?? 0);
      setLegacyEnrichPage(page);
      if (res.data.categories?.length) setLegacyEnrichCategories(res.data.categories);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Failed to load enrichment.';
      setLegacyEnrichError(msg);
    } finally {
      setLegacyEnrichLoading(false);
    }
  };

  const launchEnrichment = async () => {
    setEnrichmentLoading(true);
    setEnrichmentError(null);
    try {
      await api.post(
        `/datasets/${comparison.dataset_id}/comparisons/${encodeURIComponent(comparison.name)}/go-enrichment`,
        {
          fdr_method: 'fdr_bh',
          organism: 'Homo sapiens',
        }
      );
      setEnrichmentLaunched(true);
    } catch (err: any) {
      setEnrichmentError(err?.response?.data?.detail ?? 'GO enrichment failed to start.');
    } finally {
      setEnrichmentLoading(false);
    }
  };

  const DB_OPTIONS = [
    { id: 'GO:BP', label: 'GO: Biological Process' },
    { id: 'GO:MF', label: 'GO: Molecular Function' },
    { id: 'GO:CC', label: 'GO: Cellular Component' },
    { id: 'KEGG',  label: 'KEGG Pathways' },
    { id: 'Reactome', label: 'Reactome' },
  ];

  const toggleDb = (id: string) =>
    setEnrichDatabases((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{comparison.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <TrendingUp className="h-3 w-3" /> {comparison.deg_up} up
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                <TrendingDown className="h-3 w-3" /> {comparison.deg_down} down
              </span>
              <span className="text-xs text-gray-400">{comparison.deg_total} total DEGs</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${projectId}/comparisons/${encodeURIComponent(comparison.name)}`}
            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
          >
            Full view
          </Link>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-100">
          {/* Section tabs */}
          <div className="flex gap-1 px-4 pt-3">
            <SectionTab
              label="Statistical Filter"
              icon={<Settings className="h-3.5 w-3.5" />}
              active={activeSection === 'stats'}
              onClick={() => toggleSection('stats')}
            />
            {matrixDatasetId && (
              <SectionTab
                label="Clustering"
                icon={<BarChart2 className="h-3.5 w-3.5" />}
                active={activeSection === 'clustering'}
                onClick={() => toggleSection('clustering')}
              />
            )}
            <SectionTab
              label="Enrichment"
              icon={<Play className="h-3.5 w-3.5" />}
              active={activeSection === 'enrichment'}
              onClick={() => toggleSection('enrichment')}
            />
            {analysisId && (
              <SectionTab
                label="Legacy Enrichment"
                icon={<BarChart2 className="h-3.5 w-3.5" />}
                active={activeSection === 'legacy_enrichment'}
                onClick={() => {
                  toggleSection('legacy_enrichment');
                  if (activeSection !== 'legacy_enrichment' && !legacyEnrichData) {
                    loadLegacyEnrichment(1, '');
                  }
                }}
              />
            )}
          </div>

          {/* Section content */}
          <div className="px-5 py-4">
            {activeSection === 'none' && (
              <p className="text-xs text-gray-400">Select a section above to explore results.</p>
            )}

            {/* ── Statistical filter ── */}
            {activeSection === 'stats' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  Adjust thresholds to re-filter results client-side. Original DESeq2 results are not modified.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <SliderField
                    label="FDR threshold (padj)"
                    value={fdrThreshold}
                    min={0.001}
                    max={0.25}
                    step={0.001}
                    onChange={setFdrThreshold}
                    format={(v) => v.toFixed(3)}
                  />
                  <SliderField
                    label="Min |log2FC|"
                    value={log2fcThreshold}
                    min={0}
                    max={5}
                    step={0.1}
                    onChange={setLog2fcThreshold}
                    format={(v) => v.toFixed(1)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-2.5">
                  <span className="text-xs text-indigo-700">
                    Current filter: padj ≤ {fdrThreshold} AND |log2FC| ≥ {log2fcThreshold}
                  </span>
                  <Link
                    href={`/projects/${projectId}/comparisons/${encodeURIComponent(comparison.name)}?fdr=${fdrThreshold}&log2fc=${log2fcThreshold}`}
                    className="text-xs font-medium text-indigo-600 hover:underline"
                  >
                    View filtered results →
                  </Link>
                </div>
              </div>
            )}

            {/* ── Clustering ── */}
            {activeSection === 'clustering' && matrixDatasetId && (
              <ClusteringAnalysis
                projectId={projectId}
                datasetId={matrixDatasetId}
                datasetName="Expression matrix"
              />
            )}

            {/* ── Legacy Enrichment (anno.db) ── */}
            {activeSection === 'legacy_enrichment' && (
              <div className="space-y-3">
                {legacyEnrichError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                    <p className="text-xs text-red-700">{legacyEnrichError}</p>
                  </div>
                )}
                {legacyEnrichLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading enrichment results…
                  </div>
                )}
                {!legacyEnrichLoading && !legacyEnrichError && legacyEnrichData && (
                  <>
                    <div className="flex flex-wrap items-center gap-3">
                      {legacyEnrichCategories.length > 0 && (
                        <select
                          value={legacyEnrichCategory}
                          onChange={(e) => {
                            setLegacyEnrichCategory(e.target.value);
                            loadLegacyEnrichment(1, e.target.value);
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        >
                          <option value="">All categories</option>
                          {legacyEnrichCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      )}
                      <span className="text-xs text-gray-400">{legacyEnrichTotal} enriched terms</span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            {['term', 'category', 'pvalue', 'p.adjust.enri', 'r', 'n'].map((col) => (
                              <th key={col} className="px-3 py-2 text-left font-medium">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {legacyEnrichData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 max-w-xs truncate" title={row.term}>{row.term}</td>
                              <td className="px-3 py-1.5 text-gray-500">{row.category}</td>
                              <td className="px-3 py-1.5 font-mono">{typeof row.pvalue === 'number' ? row.pvalue.toExponential(2) : row.pvalue}</td>
                              <td className="px-3 py-1.5 font-mono">{typeof row['p.adjust.enri'] === 'number' ? row['p.adjust.enri'].toExponential(2) : row['p.adjust.enri']}</td>
                              <td className="px-3 py-1.5">{row.r}</td>
                              <td className="px-3 py-1.5">{row.n}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Pagination */}
                    {legacyEnrichTotal > PAGE_SIZE && (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          disabled={legacyEnrichPage === 1}
                          onClick={() => loadLegacyEnrichment(legacyEnrichPage - 1, legacyEnrichCategory)}
                          className="text-xs text-indigo-600 disabled:opacity-40"
                        >
                          ← Prev
                        </button>
                        <span className="text-xs text-gray-400">
                          Page {legacyEnrichPage} / {Math.ceil(legacyEnrichTotal / PAGE_SIZE)}
                        </span>
                        <button
                          type="button"
                          disabled={legacyEnrichPage >= Math.ceil(legacyEnrichTotal / PAGE_SIZE)}
                          onClick={() => loadLegacyEnrichment(legacyEnrichPage + 1, legacyEnrichCategory)}
                          className="text-xs text-indigo-600 disabled:opacity-40"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </>
                )}
                {!legacyEnrichLoading && !legacyEnrichError && legacyEnrichData === null && (
                  <p className="text-xs text-gray-400">No legacy enrichment results found for this comparison.</p>
                )}
              </div>
            )}

            {/* ── Enrichment ── */}
            {activeSection === 'enrichment' && (
              <div className="space-y-4">
                {comparison.has_enrichment || enrichmentLaunched ? (
                  <EnrichmentAnalysis datasetId={comparison.dataset_id} />
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-500">
                      Functional enrichment has not been run yet for this comparison.
                      Select databases and launch the analysis.
                    </p>
                    {/* Database selector */}
                    <div className="grid grid-cols-2 gap-2">
                      {DB_OPTIONS.map((db) => (
                        <label key={db.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enrichDatabases.includes(db.id)}
                            onChange={() => toggleDb(db.id)}
                            className="rounded border-gray-300 text-indigo-600"
                          />
                          <span className="text-xs text-gray-700">{db.label}</span>
                        </label>
                      ))}
                    </div>
                    {/* FDR for enrichment */}
                    <SliderField
                      label="Enrichment FDR"
                      value={fdrThreshold}
                      min={0.001}
                      max={0.25}
                      step={0.001}
                      onChange={setFdrThreshold}
                      format={(v) => v.toFixed(3)}
                    />
                    {enrichmentError && (
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700">{enrichmentError}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={launchEnrichment}
                      disabled={enrichmentLoading || enrichDatabases.length === 0}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enrichmentLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      Launch Enrichment
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTab({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-500 text-indigo-700 bg-indigo-50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <span className="text-xs font-semibold text-gray-900 font-mono">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-gray-200 accent-indigo-600 cursor-pointer"
      />
    </div>
  );
}
