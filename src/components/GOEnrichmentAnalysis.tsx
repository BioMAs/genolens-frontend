'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dataset } from '@/types';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import GOEnrichmentTable from './GOEnrichmentTable';
import EnrichmentHistogram from './EnrichmentHistogram';
import GOTreePanel from './GOTreePanel';
import { useComparisonActions } from '@/contexts/ComparisonSelectionContext';
import dynamic from 'next/dynamic';

const EnrichmentRadarPlot = dynamic(() => import('./EnrichmentRadarPlot'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface GOEnrichmentAnalysisProps {
  dataset: Dataset;
  comparisonName: string;
  // Dataset holding the enrichment pathways (annoDB ENRICHMENT dataset). When set,
  // pathways are read from it; DEG gene info still comes from `dataset` (the DEG dataset).
  enrichmentDataset?: Dataset;
}

interface GOEnrichmentParams {
  namespace: string | null;
  regulation: string | null;
  padjThreshold: number;
  logFcThreshold: number;
  minTermSize: number;
  maxTermSize: number;
  pvalueThreshold: number;
  propagateAnnotations: boolean;
}

interface GOTerm {
  go_id: string;
  go_name: string;
  namespace: string;
  description?: string;
  pvalue: number;
  fdr: number;
  enrichment_ratio: number;
  study_count: number;
  study_genes: string[];
  background_count: number;
  level?: number;
}

interface DegGeneInfo {
  regulation: string;
  log_fc: number;
  padj: number;
  gene_name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function transformCachedRow(row: Record<string, unknown>): GOTerm {
  const geneRatioStr = (row.gene_ratio as string) ?? '0/1';
  const [studyCount] = geneRatioStr.split('/').map(Number);
  const bgRatioStr = (row.bg_ratio as string) ?? '0/1';
  const [bgCount] = bgRatioStr.split('/').map(Number);
  return {
    go_id: (row.pathway_id as string) ?? '',
    go_name: (row.pathway_name as string) ?? '',
    namespace: (row.category as string) ?? '',
    description: (row.description as string) ?? undefined,
    pvalue: (row.pvalue as number) ?? 0,
    fdr: (row.padj as number) ?? 0,
    enrichment_ratio: (row.enrichment_ratio as number) ?? 0,
    study_count: (row.gene_count as number) ?? studyCount ?? 0,
    study_genes: (row.genes as string[]) ?? [],
    background_count: bgCount ?? 0,
    level: (row.level as number | undefined),
  };
}

type TabId = 'dotplot' | 'histogram' | 'radar' | 'table';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dotplot', label: 'Dot Plot' },
  { id: 'histogram', label: 'Histogram' },
  { id: 'radar', label: 'Radar Chart' },
  { id: 'table', label: 'Table' },
];

// ─── Inline dot plot (bubble chart) ──────────────────────────────────────────

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer, Cell, ZAxis,
} from 'recharts';

interface DotPlotTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GOTerm & { x: number; z: number } }>;
}

function DotPlotTooltip({ active, payload }: DotPlotTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-60">
      <div className="font-semibold text-gray-900 mb-1 leading-snug">{d.go_name}</div>
      <div className="text-indigo-500 mb-2">{d.go_id}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
        <span>FDR</span><span className="font-semibold text-indigo-700">{d.fdr.toExponential(2)}</span>
        <span>Gene ratio</span><span className="font-semibold">{d.x.toFixed(3)}</span>
        <span>Enrichment</span><span className="font-semibold">{d.enrichment_ratio.toFixed(2)}×</span>
        <span>Genes</span><span className="font-semibold">{d.study_count}</span>
      </div>
    </div>
  );
}

function GODotPlot({ terms }: { terms: GOTerm[] }) {
  if (!terms.length) return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      No enriched terms to display.
    </div>
  );

  const top = [...terms].sort((a, b) => a.fdr - b.fdr).slice(0, 20).reverse();
  const maxFdr = Math.max(...top.map(t => -Math.log10(t.fdr)));

  const data = top.map(t => ({
    ...t,
    x: t.study_count / Math.max(1, t.study_count + t.background_count),
    y: t.go_name.length > 35 ? t.go_name.slice(0, 32) + '…' : t.go_name,
    z: t.study_count,
    color: `hsl(${244 - Math.round(((-Math.log10(t.fdr)) / maxFdr) * 30)}, ${60 + Math.round(((-Math.log10(t.fdr)) / maxFdr) * 20)}%, ${60 - Math.round(((-Math.log10(t.fdr)) / maxFdr) * 20)}%)`,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3 text-xs text-muted-foreground">
        <span>Top 20 enriched terms · Dot size = gene count · Color = -log₁₀(FDR)</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-10 h-2.5 rounded" style={{ background: 'linear-gradient(to right, #c7d2fe, #4338ca)' }} />
          <span>High FDR → Low FDR</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(240, top.length * 26)}>
        <ScatterChart margin={{ top: 4, right: 24, left: 8, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            type="number" dataKey="x" name="Gene Ratio"
            tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
            label={{ value: 'Gene Ratio', position: 'insideBottom', offset: -12, fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            type="category" dataKey="y" width={210}
            tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false}
          />
          <ZAxis type="number" dataKey="z" range={[20, 120]} />
          <RechartTooltip content={<DotPlotTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter data={data}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} fillOpacity={0.85} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

// Known database categories with labels and colors for the selector
const DB_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'GO:BP', label: 'GO: Biological Process', color: 'text-blue-600' },
  { value: 'GO:MF', label: 'GO: Molecular Function', color: 'text-green-600' },
  { value: 'GO:CC', label: 'GO: Cellular Component', color: 'text-purple-600' },
  { value: 'KEGG', label: 'KEGG Pathways', color: 'text-orange-600' },
  { value: 'REACTOME', label: 'Reactome Pathways', color: 'text-cyan-700' },
  { value: 'HALLMARK', label: 'MSigDB Hallmark', color: 'text-rose-600' },
  { value: 'C5_ONTOLOGY', label: 'MSigDB C5 Ontology', color: 'text-teal-600' },
  { value: 'C7_IMMUNOLOGIC', label: 'MSigDB C7 Immunologic', color: 'text-indigo-600' },
];

export default function GOEnrichmentAnalysis({ dataset, comparisonName, enrichmentDataset }: GOEnrichmentAnalysisProps) {
  const { focusTerm } = useComparisonActions();
  // Pathways live on the ENRICHMENT dataset (annoDB); DEG genes on the DEG dataset.
  const enrichmentDatasetId = enrichmentDataset?.id ?? dataset.id;
  const [isRunning, setIsRunning] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [terms, setTerms] = useState<GOTerm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dotplot');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [degGeneMap, setDegGeneMap] = useState<Record<string, DegGeneInfo>>({});

  const [params, setParams] = useState<GOEnrichmentParams>({
    namespace: null,
    regulation: null,
    padjThreshold: 0.05,
    logFcThreshold: 0.5,
    minTermSize: 5,
    maxTermSize: 500,
    pvalueThreshold: 0.05,
    propagateAnnotations: true,
  });

  const updateParams = (next: GOEnrichmentParams) => setParams(next);

  // On mount: load all cached enrichment results from DB (all databases)
  const loadCached = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const res = await api.get(
        `/datasets/${enrichmentDatasetId}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
        { params: { page_size: 1000 } }
      );
      const rows: Record<string, unknown>[] = res.data?.pathways ?? res.data?.results ?? res.data ?? [];
      if (rows.length > 0) {
        setTerms(rows.map(transformCachedRow));
        setIsInitialLoad(false);
        return true;
      }
    } catch {
      setError('Failed to load enrichment cache.');
    }
    return false;
  }, [enrichmentDatasetId, comparisonName]);

  // Fetch DEG gene map for UP/DOWN coloring — paginate through all pages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const PAGE_SIZE = 1000;
        const map: Record<string, DegGeneInfo> = {};

        // Fetch first page to get total_pages
        const first = await api.get(
          `/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`,
          { params: { page_size: PAGE_SIZE, page: 1 } }
        );
        if (cancelled) return;

        const addGenes = (genes: Array<{gene_id: string; regulation: string; log_fc: number; padj: number; gene_name: string}>) => {
          genes.forEach(g => {
            const info: DegGeneInfo = { regulation: g.regulation, log_fc: g.log_fc, padj: g.padj, gene_name: g.gene_name };
            // Index by both Ensembl ID and gene symbol for broad matching
            if (g.gene_id) map[g.gene_id.toUpperCase()] = info;
            if (g.gene_name) map[g.gene_name.toUpperCase()] = info;
          });
        };

        addGenes(first.data?.genes ?? []);
        const totalPages: number = first.data?.pagination?.total_pages ?? 1;

        // Fetch remaining pages in parallel (max 5 extra = 6000 genes total)
        const remainingPages = Math.min(totalPages, 6);
        const requests = [];
        for (let p = 2; p <= remainingPages; p++) {
          requests.push(api.get(
            `/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`,
            { params: { page_size: PAGE_SIZE, page: p } }
          ));
        }
        const results = await Promise.all(requests);
        if (cancelled) return;
        results.forEach(r => addGenes(r.data?.genes ?? []));

        setDegGeneMap(map);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [dataset.id, comparisonName]);

  // Initial load: load from cache only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadCached();
      if (!cancelled) setIsRunning(false);
    })();
    return () => { cancelled = true; };
  }, [loadCached]);

  const hasResults = terms.length > 0;

  // Apply category + regulation filters for display
  const displayTerms = terms.filter(t => {
    if (params.namespace && t.namespace !== params.namespace) return false;
    if (params.regulation && params.regulation !== 'all') {
      const reg = (t as GOTerm & { regulation?: string }).regulation;
      if (reg && reg !== params.regulation) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Pathway Enrichment</h3>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </span>
          )}
          {!isRunning && hasResults && (
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              {terms.length} enriched terms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 text-xs gap-1.5 ${showSettings ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}
            onClick={() => setShowSettings(s => !s)}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Filter
            {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* ── Collapsible Settings ─────────────────────────────────────────── */}
      {showSettings && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Database / Category</Label>
                <Select
                  value={params.namespace || 'all'}
                  onValueChange={(v) => updateParams({ ...params, namespace: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All databases" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Databases</SelectItem>
                    {DB_CATEGORIES
                      .filter(db => terms.some(t => t.namespace === db.value))
                      .map(db => (
                        <SelectItem key={db.value} value={db.value}>
                          <span className={db.color}>{db.label}</span>
                        </SelectItem>
                      ))
                    }
                    {/* Show unknown categories present in results */}
                    {[...new Set(terms.map(t => t.namespace).filter(Boolean))]
                      .filter(ns => !DB_CATEGORIES.some(db => db.value === ns))
                      .map(ns => (
                        <SelectItem key={ns} value={ns}>{ns}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Regulation</Label>
                <Select
                  value={params.regulation || 'all'}
                  onValueChange={(v) => updateParams({ ...params, regulation: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All genes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All DEGs</SelectItem>
                    <SelectItem value="UP">Upregulated Only</SelectItem>
                    <SelectItem value="DOWN">Downregulated Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Adj. P-value Threshold</Label>
                <Input
                  className="h-8 text-xs"
                  type="number" step="0.01" min="0" max="1"
                  value={params.padjThreshold}
                  onChange={(e) => updateParams({ ...params, padjThreshold: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(s => !s)}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              Advanced options
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs">Log FC Threshold</Label>
                  <Input className="h-8 text-xs" type="number" step="0.1" min="0" value={params.logFcThreshold}
                    onChange={(e) => updateParams({ ...params, logFcThreshold: parseFloat(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Min Term Size</Label>
                  <Input className="h-8 text-xs" type="number" min="1" value={params.minTermSize}
                    onChange={(e) => updateParams({ ...params, minTermSize: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Max Term Size</Label>
                  <Input className="h-8 text-xs" type="number" min="1" value={params.maxTermSize}
                    onChange={(e) => updateParams({ ...params, maxTermSize: parseInt(e.target.value) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Enrichment P-value</Label>
                  <Input className="h-8 text-xs" type="number" step="0.01" min="0" max="1" value={params.pvalueThreshold}
                    onChange={(e) => updateParams({ ...params, pvalueThreshold: parseFloat(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input type="checkbox" id="propagate" checked={params.propagateAnnotations}
                    onChange={(e) => updateParams({ ...params, propagateAnnotations: e.target.checked })}
                    className="rounded" />
                  <Label htmlFor="propagate" className="cursor-pointer text-xs">Propagate Annotations (True Path Rule)</Label>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading skeleton (first load) ────────────────────────────────── */}
      {isInitialLoad && isRunning && (
        <div className="space-y-3 animate-pulse">
          <div className="h-10 bg-gray-100 rounded-lg" />
          <div className="h-64 bg-gray-50 rounded-xl border border-gray-100" />
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Stats bar — dynamic: shows all categories present in results */}
          {terms.length > 0 && (
            <div className="flex items-center gap-5 px-4 py-2 bg-muted/40 rounded-lg text-xs text-muted-foreground flex-wrap">
              {[...new Set(terms.map(t => t.namespace).filter(Boolean))].map(cat => {
                const count = terms.filter(t => t.namespace === cat).length;
                const dbDef = DB_CATEGORIES.find(db => db.value === cat);
                return (
                  <button
                    key={cat}
                    onClick={() => updateParams({ ...params, namespace: params.namespace === cat ? null : cat })}
                    className={`transition-colors ${params.namespace === cat ? 'font-semibold text-foreground' : 'hover:text-foreground'}`}
                  >
                    {count} {dbDef ? dbDef.label.replace(/^(GO: |MSigDB )/, '') : cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Visualization tabs */}
          <Card className={isRunning ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <div className="flex border-b border-gray-100 bg-gray-50 rounded-t-xl overflow-hidden">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'text-indigo-600 border-indigo-500 bg-white'
                      : 'text-gray-400 border-transparent hover:text-gray-600'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <CardContent className="pt-5">
              {activeTab === 'dotplot' && <GODotPlot terms={displayTerms} />}
              {activeTab === 'histogram' && <EnrichmentHistogram terms={displayTerms} />}
              {activeTab === 'radar' && (
                <EnrichmentRadarPlot
                  datasetId={enrichmentDatasetId}
                  comparisonName={comparisonName}
                />
              )}
              {activeTab === 'table' && (
                <GOEnrichmentTable
                  terms={displayTerms}
                  degGeneMap={degGeneMap}
                  // The wire that was sketched and left unconnected: clicking a term now
                  // re-seeds the network and the signature panel on the same screen, rather
                  // than navigating anywhere.
                  onTermSelect={(term) =>
                    focusTerm({
                      id: term.go_id,
                      name: term.go_name,
                      genes: term.study_genes ?? [],
                    })
                  }
                />
              )}
            </CardContent>
          </Card>

          {/* GO Hierarchy Tree */}
          <GOTreePanel
            datasetId={enrichmentDatasetId}
            comparisonName={comparisonName}
            regulation={params.regulation ?? undefined}
          />
        </>
      )}

      {/* ── Empty state (loaded but no results) ─────────────────────────── */}
      {!isRunning && !error && !isInitialLoad && !hasResults && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          <p className="text-sm font-medium mb-1">No enriched terms found</p>
          <p className="text-xs">Enrichment analysis has not been computed yet for this comparison.</p>
        </div>
      )}
    </div>
  );
}
