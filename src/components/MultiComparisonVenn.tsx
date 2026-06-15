'use client';

import { FC, useMemo, useState } from 'react';
import {
  VennDiagram as VennDiagramImpl,
  UpSetJS as UpSetJSImpl,
  extractCombinations,
  ISetLike,
  ISets,
  ISetCombinations,
} from '@upsetjs/react';
import api from '@/utils/api';
import { exportToCSV, exportToJSON } from '@/lib/exportUtils';
import { useIntersectionEnrichment, EnrichmentRow } from '@/hooks/useIntersectionEnrichment';

// @upsetjs ships generic component signatures that current @types/react flags as
// invalid JSX elements (a type-only mismatch). Cast to plain FCs with the props
// we use; runtime behaviour is unaffected.
interface DiagramProps {
  sets: ISets<GeneElem>;
  combinations: ISetCombinations<GeneElem>;
  width: number;
  height: number;
  selection: ISetLike<GeneElem> | null;
  onClick: (s: ISetLike<GeneElem> | null) => void;
  theme?: 'light' | 'dark' | 'vega';
}
const VennDiagram = VennDiagramImpl as unknown as FC<DiagramProps>;
const UpSetJS = UpSetJSImpl as unknown as FC<DiagramProps>;

// One comparison, tagged with the DEG dataset that holds it.
// `key` is a guaranteed-unique selection id (`datasetId::comparisonName`) — two
// distinct datasets may share a comparison name, so selection must key on this,
// not on `label`. `label` is the (also unique) human-readable name shown in the
// UI and used as the Venn set name by the backend.
export interface ComparisonRef {
  key: string;
  datasetId: string;
  comparisonName: string;
  label: string;
  degCount: number;
}

interface MultiComparisonVennProps {
  projectId: string;
  pathDatasetId: string; // Any dataset id in the project; used for the endpoint URL + access check
  comparisons: ComparisonRef[]; // Comparisons aggregated from all DEG datasets
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

interface VennResponse {
  sets: string[];
  set_genes: Record<string, string[]>;
}

// One element per gene, tagged with the comparison labels it belongs to.
interface GeneElem {
  name: string;
  sets: string[];
}

export default function MultiComparisonVenn({ pathDatasetId, comparisons: availableComparisons }: MultiComparisonVennProps) {
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);
  const [vennData, setVennData] = useState<VennResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<ISetLike<GeneElem> | null>(null);
  const [category, setCategory] = useState<string>('ALL');

  const enrichment = useIntersectionEnrichment(pathDatasetId);

  const handleComparisonToggle = (compKey: string) => {
    setSelectedComparisons(prev => {
      if (prev.includes(compKey)) return prev.filter(c => c !== compKey);
      if (prev.length >= 5) {
        setError('Maximum 5 comparisons allowed');
        return prev;
      }
      return [...prev, compKey];
    });
    setError(null);
  };

  const fetchVennData = async () => {
    if (selectedComparisons.length < 2) {
      setError('Select at least 2 comparisons');
      return;
    }
    setLoading(true);
    setError(null);
    setSelection(null);
    enrichment.reset();

    try {
      const selectedRefs = availableComparisons
        .filter((c) => selectedComparisons.includes(c.key))
        .map((c) => ({ dataset_id: c.datasetId, comparison_name: c.comparisonName, label: c.label }));

      const response = await api.post(`/datasets/${pathDatasetId}/venn-analysis`, {
        comparison_refs: selectedRefs,
        padj_threshold: 0.05,
        logfc_threshold: 0.58,
      });
      setVennData(response.data);
    } catch (err: unknown) {
      const detail = (err as ApiErrorShape)?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to generate analysis');
      console.error('Venn analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build @upsetjs sets/combinations from the per-set gene lists.
  const { sets, combinations, setCount } = useMemo(() => {
    if (!vennData?.set_genes) return { sets: [], combinations: [], setCount: 0 };
    const membership = new Map<string, string[]>();
    for (const [label, genes] of Object.entries(vennData.set_genes)) {
      for (const g of genes) {
        const arr = membership.get(g);
        if (arr) arr.push(label);
        else membership.set(g, [label]);
      }
    }
    const elements: GeneElem[] = Array.from(membership.entries()).map(([name, s]) => ({ name, sets: s }));
    const extracted = extractCombinations<GeneElem>(elements, (e) => e.sets, {
      type: 'distinctIntersection',
    });
    return {
      sets: extracted.sets,
      combinations: extracted.combinations,
      setCount: Object.keys(vennData.set_genes).length,
    };
  }, [vennData]);

  const selectedGenes: string[] = useMemo(
    () => (selection ? Array.from(selection.elems).map((e) => e.name).sort() : []),
    [selection]
  );

  const categories = useMemo(() => {
    const rows = enrichment.result || [];
    return Array.from(new Set(rows.map((r) => r.category).filter(Boolean))).sort();
  }, [enrichment.result]);

  const filteredEnrichment: EnrichmentRow[] = useMemo(() => {
    const rows = enrichment.result || [];
    return category === 'ALL' ? rows : rows.filter((r) => r.category === category);
  }, [enrichment.result, category]);

  const maxNegLog = useMemo(
    () => Math.max(1, ...filteredEnrichment.slice(0, 15).map((r) => (r.padj ? -Math.log10(r.padj) : 0))),
    [filteredEnrichment]
  );

  const exportGenes = (fmt: 'csv' | 'json') => {
    const rows = selectedGenes.map((g) => ({ gene: g }));
    const base = `intersection_${(selection?.name || 'genes').replace(/[^\w]+/g, '_')}`;
    if (fmt === 'csv') exportToCSV(rows, base, [{ key: 'gene', label: 'Gene' }]);
    else exportToJSON(rows, base);
  };

  const exportEnrichment = (fmt: 'csv' | 'json') => {
    const base = `enrichment_${(selection?.name || 'intersection').replace(/[^\w]+/g, '_')}`;
    if (fmt === 'json') {
      exportToJSON(filteredEnrichment, base);
      return;
    }
    const rows = filteredEnrichment.map((r) => ({
      category: r.category,
      pathway_id: r.pathway_id,
      pathway_name: r.pathway_name,
      pvalue: r.pvalue,
      padj: r.padj,
      gene_count: r.gene_count,
      gene_ratio: r.gene_ratio,
      genes: r.genes.join(';'),
    }));
    exportToCSV(rows, base, [
      { key: 'category', label: 'Category' },
      { key: 'pathway_id', label: 'ID' },
      { key: 'pathway_name', label: 'Term' },
      { key: 'pvalue', label: 'p-value' },
      { key: 'padj', label: 'FDR' },
      { key: 'gene_count', label: 'Genes' },
      { key: 'gene_ratio', label: 'GeneRatio' },
      { key: 'genes', label: 'Gene list' },
    ]);
  };

  const isIntersection = !!selection && selection.type !== 'set';
  const enrichRunning = enrichment.status === 'PENDING' || enrichment.status === 'RUNNING';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Multi-Comparison Analysis</h2>
        <p className="mt-1 text-sm text-gray-500">
          Compare 2–5 comparisons, click an intersection to inspect its genes and run functional enrichment
        </p>
      </div>

      {/* Comparison Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Select Comparisons ({selectedComparisons.length}/5)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableComparisons.map((comp) => (
            <label
              key={comp.key}
              className={`relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedComparisons.includes(comp.key)
                  ? 'border-brand-primary bg-brand-primary/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedComparisons.includes(comp.key)}
                onChange={() => handleComparisonToggle(comp.key)}
                className="h-4 w-4 shrink-0 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
              />
              <div className="ml-3 flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 break-words" title={comp.label}>{comp.label}</div>
                <div className="text-xs text-gray-500">{comp.degCount} DEGs</div>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={fetchVennData}
            disabled={selectedComparisons.length < 2 || loading}
            className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Analyzing…' : 'Generate Analysis'}
          </button>
          {selectedComparisons.length > 0 && (
            <button
              onClick={() => { setSelectedComparisons([]); setVennData(null); setSelection(null); enrichment.reset(); }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Diagram */}
      {vennData && sets.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {setCount <= 3 ? 'Venn Diagram' : 'UpSet Plot'}
          </h3>
          <p className="text-sm text-gray-500 mb-4">Click a region to select that intersection.</p>
          <div className="flex justify-center overflow-x-auto">
            {setCount <= 3 ? (
              <VennDiagram
                sets={sets}
                combinations={combinations}
                width={620}
                height={420}
                selection={selection}
                onClick={(s) => setSelection(s as ISetLike<GeneElem>)}
                theme="light"
              />
            ) : (
              <UpSetJS
                sets={sets}
                combinations={combinations}
                width={760}
                height={460}
                selection={selection}
                onClick={(s) => setSelection(s as ISetLike<GeneElem>)}
                theme="light"
              />
            )}
          </div>
        </div>
      )}

      {/* Selected intersection: genes + enrichment */}
      {selection && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{selection.name}</h3>
              <p className="text-sm text-gray-500">{selectedGenes.length} genes in this selection</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => exportGenes('csv')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Export genes (CSV)</button>
              <button onClick={() => exportGenes('json')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">JSON</button>
              <button
                onClick={() => enrichment.run(selectedGenes, selection.name)}
                disabled={selectedGenes.length < 1 || enrichRunning}
                className="px-3 py-1.5 text-sm bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
              >
                {enrichRunning ? 'Running enrichment…' : 'Run functional enrichment'}
              </button>
            </div>
          </div>

          {/* Gene chips */}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {selectedGenes.map((g) => (
              <span key={g} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded">{g}</span>
            ))}
          </div>

          {/* Enrichment results */}
          {enrichment.status === 'FAILED' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
              {enrichment.error || 'Enrichment failed'}
            </div>
          )}

          {enrichment.status === 'DONE' && (
            <div className="border-t border-gray-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h4 className="text-md font-semibold text-gray-900">
                  Functional enrichment {isIntersection ? '' : ''}({(enrichment.result || []).length} terms)
                </h4>
                <div className="flex gap-2">
                  <button onClick={() => exportEnrichment('csv')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Export (CSV)</button>
                  <button onClick={() => exportEnrichment('json')} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50">JSON</button>
                </div>
              </div>

              {(enrichment.result || []).length === 0 ? (
                <p className="text-sm text-gray-500">No enriched terms for this gene set.</p>
              ) : (
                <>
                  {/* Category filter */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {['ALL', ...categories].map((c) => (
                      <button
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-2.5 py-1 text-xs rounded-full border ${
                          category === c
                            ? 'bg-brand-primary text-white border-brand-primary'
                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>

                  {/* Top terms bar (−log10 FDR) */}
                  <div className="space-y-1 mb-5">
                    {filteredEnrichment.slice(0, 15).map((r) => {
                      const v = r.padj ? -Math.log10(r.padj) : 0;
                      return (
                        <div key={`${r.category}-${r.pathway_id}`} className="flex items-center gap-2">
                          <div className="w-64 truncate text-xs text-gray-700" title={r.pathway_name}>{r.pathway_name}</div>
                          <div className="flex-1 bg-gray-100 rounded h-3">
                            <div className="bg-indigo-500 h-3 rounded" style={{ width: `${(v / maxNegLog) * 100}%` }} />
                          </div>
                          <div className="w-16 text-right text-xs text-gray-500">{v.toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Terms table */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Term</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">FDR</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Genes</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredEnrichment.slice(0, 200).map((r) => (
                          <tr key={`${r.category}-${r.pathway_id}`} className="hover:bg-gray-50 align-top">
                            <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{r.category}</td>
                            <td className="px-3 py-2 text-gray-900">
                              <div className="font-medium">{r.pathway_name}</div>
                              <div className="text-xs text-gray-400">{r.pathway_id}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.padj != null ? r.padj.toExponential(2) : '—'}</td>
                            <td className="px-3 py-2 text-gray-600">
                              {r.gene_count} <span className="text-xs text-gray-400">({r.gene_ratio})</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
