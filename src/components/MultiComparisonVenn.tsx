'use client';

import { FC, useMemo, useState } from 'react';
import {
  UpSetJS as UpSetJSImpl,
  extractCombinations,
  ISetLike,
  ISets,
  ISetCombinations,
} from '@upsetjs/react';
import api from '@/utils/api';
import { exportToCSV, exportToJSON } from '@/lib/exportUtils';
import { useIntersectionEnrichment, EnrichmentRow } from '@/hooks/useIntersectionEnrichment';
import { Button } from '@/components/ui/button';
import { ConditionPill } from '@/components/ui/condition-pill';
import ProportionalVenn, { VennRegion } from '@/components/viz/ProportionalVenn';

// @upsetjs ships generic component signatures that current @types/react flags as
// invalid JSX elements (a type-only mismatch). Cast to a plain FC with the props
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
const UpSetJS = UpSetJSImpl as unknown as FC<DiagramProps>;

const CONDITION_PALETTE = ['var(--dc-indigo)', 'var(--dc-pink)', 'var(--dc-green)', 'var(--dc-amber)', 'var(--sl-violet)'];

// One comparison, tagged with the DEG dataset that holds it.
export interface ComparisonRef {
  key: string;
  datasetId: string;
  comparisonName: string;
  label: string;
  degCount: number;
}

interface MultiComparisonVennProps {
  projectId: string;
  pathDatasetId: string;
  comparisons: ComparisonRef[];
}

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

interface VennResponse {
  sets: string[];
  set_genes: Record<string, string[]>;
}

interface GeneElem {
  name: string;
  sets: string[];
}

/** Unified selection shape, driven by both the proportional Venn and UpSet. */
interface Selection {
  name: string;
  genes: string[];
}

export default function MultiComparisonVenn({ pathDatasetId, comparisons: availableComparisons }: MultiComparisonVennProps) {
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);
  const [vennData, setVennData] = useState<VennResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [category, setCategory] = useState<string>('ALL');

  const enrichment = useIntersectionEnrichment(pathDatasetId);

  const handleComparisonToggle = (compKey: string) => {
    setSelectedComparisons((prev) => {
      if (prev.includes(compKey)) return prev.filter((c) => c !== compKey);
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

  const setCount = vennData ? Object.keys(vennData.set_genes).length : 0;

  // @upsetjs sets/combinations — only needed for the 4–5 set UpSet fallback.
  const { sets, combinations } = useMemo(() => {
    if (!vennData?.set_genes) return { sets: [], combinations: [] };
    const membership = new Map<string, string[]>();
    for (const [label, genes] of Object.entries(vennData.set_genes)) {
      for (const g of genes) {
        const arr = membership.get(g);
        if (arr) arr.push(label);
        else membership.set(g, [label]);
      }
    }
    const elements: GeneElem[] = Array.from(membership.entries()).map(([name, s]) => ({ name, sets: s }));
    const extracted = extractCombinations<GeneElem>(elements, (e) => e.sets, { type: 'distinctIntersection' });
    return { sets: extracted.sets, combinations: extracted.combinations };
  }, [vennData]);

  // Genes shared by ALL selected comparisons — the "core".
  const sharedByAll = useMemo(() => {
    if (!vennData?.set_genes) return [] as string[];
    const lists = Object.values(vennData.set_genes);
    if (!lists.length) return [];
    const [first, ...rest] = lists;
    const others = rest.map((l) => new Set(l));
    return first.filter((g) => others.every((s) => s.has(g)));
  }, [vennData]);

  const selectedGenes = selection?.genes ?? [];

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
    [filteredEnrichment],
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

  const enrichRunning = enrichment.status === 'PENDING' || enrichment.status === 'RUNNING';
  const selectFromUpset = (s: ISetLike<GeneElem> | null) =>
    setSelection(s ? { name: s.name, genes: Array.from(s.elems).map((e) => e.name) } : null);
  const selectFromVenn = (r: VennRegion) => setSelection(r);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="page-title">Multi-comparison</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Compare 2–5 comparisons — click a region to inspect its genes and run functional enrichment.
        </p>
      </div>

      {/* Comparison selection */}
      <div className="gl-card p-6">
        <h3 className="mb-4 font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Select comparisons ({selectedComparisons.length}/5)
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {availableComparisons.map((comp) => {
            const active = selectedComparisons.includes(comp.key);
            return (
              <label
                key={comp.key}
                className="flex cursor-pointer items-center rounded-xl border p-3.5 transition-all"
                style={{
                  borderColor: active ? 'var(--sl-teal-muted)' : 'var(--border)',
                  background: active ? 'var(--sl-teal-light)' : 'var(--surface)',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => handleComparisonToggle(comp.key)}
                  className="h-4 w-4 shrink-0 accent-[var(--sl-teal)]"
                />
                <div className="ml-3 min-w-0 flex-1">
                  <div className="break-words text-sm font-medium" style={{ color: 'var(--text-primary)' }} title={comp.label}>
                    {comp.label}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {comp.degCount} DEGs
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {error && (
          <div
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)', color: 'var(--sl-red-dark)' }}
          >
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <Button onClick={fetchVennData} disabled={selectedComparisons.length < 2 || loading}>
            {loading ? 'Analyzing…' : 'Generate analysis'}
          </Button>
          {selectedComparisons.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedComparisons([]);
                setVennData(null);
                setSelection(null);
                enrichment.reset();
              }}
            >
              Clear selection
            </Button>
          )}
        </div>
      </div>

      {/* Diagram + verdict */}
      {vennData && (setCount <= 3 ? Object.keys(vennData.set_genes).length > 0 : sets.length > 0) && (
        <div className="gl-card p-7">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.35fr_1fr]">
            <div className="flex justify-center overflow-x-auto">
              {setCount <= 3 ? (
                <ProportionalVenn
                  setGenes={vennData.set_genes}
                  selectedName={selection?.name}
                  onSelect={selectFromVenn}
                />
              ) : (
                <UpSetJS
                  sets={sets}
                  combinations={combinations}
                  width={760}
                  height={460}
                  selection={null}
                  onClick={selectFromUpset}
                  theme="light"
                />
              )}
            </div>

            {/* Verdict / shared core */}
            <div>
              <div className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.6px]" style={{ color: 'var(--sl-teal)' }}>
                The verdict
              </div>
              <h3
                className="font-display text-[22px] font-semibold leading-[1.3] tracking-[-0.4px]"
                style={{ color: 'var(--text-primary)' }}
              >
                A shared {sharedByAll.length}-gene core runs through all {setCount} comparisons
              </h3>
              <p className="mt-2.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                Click any region of the diagram to inspect its genes and run functional enrichment on that exact
                intersection.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.keys(vennData.set_genes).map((label, i) => (
                  <ConditionPill key={label} label={label} color={CONDITION_PALETTE[i % CONDITION_PALETTE.length]} size="sm" />
                ))}
              </div>
              {sharedByAll.length > 0 && (
                <button
                  className="mt-4 text-[13px] font-semibold"
                  style={{ color: 'var(--sl-purple)' }}
                  onClick={() => selectFromVenn({ name: `Shared by all ${setCount}`, genes: sharedByAll })}
                >
                  Inspect the {sharedByAll.length}-gene core →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selected intersection: genes + enrichment */}
      {selection && (
        <div className="gl-card space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selection.name}
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {selectedGenes.length} genes in this selection
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => exportGenes('csv')}>
                Export genes (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportGenes('json')}>
                JSON
              </Button>
              <Button size="sm" onClick={() => enrichment.run(selectedGenes, selection.name)} disabled={selectedGenes.length < 1 || enrichRunning}>
                {enrichRunning ? 'Running enrichment…' : 'Run functional enrichment'}
              </Button>
            </div>
          </div>

          {/* Gene chips */}
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {selectedGenes.map((g) => (
              <span
                key={g}
                className="rounded px-2 py-0.5 font-mono text-xs"
                style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}
              >
                {g}
              </span>
            ))}
          </div>

          {enrichment.status === 'FAILED' && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)', color: 'var(--sl-red-dark)' }}
            >
              {enrichment.error || 'Enrichment failed'}
            </div>
          )}

          {enrichment.status === 'DONE' && (
            <div className="border-t pt-5" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="font-display text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Functional enrichment ({(enrichment.result || []).length} terms)
                </h4>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportEnrichment('csv')}>
                    Export (CSV)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportEnrichment('json')}>
                    JSON
                  </Button>
                </div>
              </div>

              {(enrichment.result || []).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  No enriched terms for this gene set.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {['ALL', ...categories].map((c) => {
                      const activeCat = category === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          className="rounded-full border px-2.5 py-1 text-xs font-medium"
                          style={
                            activeCat
                              ? { background: 'var(--sl-purple)', color: '#fff', borderColor: 'var(--sl-purple)' }
                              : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                          }
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>

                  {/* Top terms bar (−log10 FDR) */}
                  <div className="mb-5 space-y-1">
                    {filteredEnrichment.slice(0, 15).map((r) => {
                      const v = r.padj ? -Math.log10(r.padj) : 0;
                      return (
                        <div key={`${r.category}-${r.pathway_id}`} className="flex items-center gap-2">
                          <div className="w-64 truncate text-xs" style={{ color: 'var(--text-secondary)' }} title={r.pathway_name}>
                            {r.pathway_name}
                          </div>
                          <div className="h-3 flex-1 overflow-hidden rounded" style={{ background: 'var(--n-100)' }}>
                            <div className="h-3 rounded" style={{ width: `${(v / maxNegLog) * 100}%`, background: 'var(--sl-purple)' }} />
                          </div>
                          <div className="w-16 text-right text-xs" style={{ color: 'var(--text-muted)' }}>
                            {v.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="data-table min-w-full">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Term</th>
                          <th>FDR</th>
                          <th>Genes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEnrichment.slice(0, 200).map((r) => (
                          <tr key={`${r.category}-${r.pathway_id}`}>
                            <td className="whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
                              {r.category}
                            </td>
                            <td>
                              <div className="font-medium">{r.pathway_name}</div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {r.pathway_id}
                              </div>
                            </td>
                            <td className="whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                              {r.padj != null ? r.padj.toExponential(2) : '—'}
                            </td>
                            <td style={{ color: 'var(--text-secondary)' }}>
                              {r.gene_count} <span className="text-xs" style={{ color: 'var(--text-muted)' }}>({r.gene_ratio})</span>
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
