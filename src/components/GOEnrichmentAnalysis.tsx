'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dataset } from '@/types';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, RefreshCw, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import GOEnrichmentTable from './GOEnrichmentTable';
import EnrichmentHistogram from './EnrichmentHistogram';
import GOTreePanel from './GOTreePanel';
import dynamic from 'next/dynamic';

const EnrichmentRadarPlot = dynamic(() => import('./EnrichmentRadarPlot'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface GOEnrichmentAnalysisProps {
  dataset: Dataset;
  comparisonName: string;
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
  pvalue: number;
  fdr: number;
  enrichment_ratio: number;
  study_count: number;
  study_genes: string[];
  background_count: number;
  level?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NS_FROM_CATEGORY: Record<string, string> = {
  'GO:BP': 'biological_process',
  'GO:MF': 'molecular_function',
  'GO:CC': 'cellular_component',
  'GO:ALL': 'biological_process',
};

function transformCachedRow(row: Record<string, unknown>): GOTerm {
  const geneRatioStr = (row.gene_ratio as string) ?? '0/1';
  const [studyCount] = geneRatioStr.split('/').map(Number);
  const bgRatioStr = (row.bg_ratio as string) ?? '0/1';
  const [bgCount] = bgRatioStr.split('/').map(Number);
  return {
    go_id: (row.pathway_id as string) ?? '',
    go_name: (row.pathway_name as string) ?? '',
    namespace: NS_FROM_CATEGORY[(row.category as string) ?? ''] ?? 'biological_process',
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
          <ZAxis type="number" dataKey="z" range={[40, 220]} />
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

const DEBOUNCE_MS = 800;

export default function GOEnrichmentAnalysis({ dataset, comparisonName }: GOEnrichmentAnalysisProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [terms, setTerms] = useState<GOTerm[]>([]);
  const [meta, setMeta] = useState<{ study_size: number; background_size: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dotplot');
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // Track whether params have changed since last run (to show "pending" indicator)
  const [paramsDirty, setParamsDirty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);

  const runGOEnrichment = useCallback(async (currentParams: GOEnrichmentParams) => {
    setIsRunning(true);
    setError(null);
    setParamsDirty(false);

    try {
      const response = await api.post(
        `/datasets/${dataset.id}/comparisons/${encodeURIComponent(comparisonName)}/go-enrichment`,
        {
          namespace: currentParams.namespace,
          regulation: currentParams.regulation,
          padj_threshold: currentParams.padjThreshold,
          log_fc_threshold: currentParams.logFcThreshold,
          min_term_size: currentParams.minTermSize,
          max_term_size: currentParams.maxTermSize,
          pvalue_threshold: currentParams.pvalueThreshold,
          fdr_method: 'fdr_bh',
          propagate_annotations: currentParams.propagateAnnotations,
          organism: 'Homo sapiens',
        }
      );

      const data = response.data;
      const enrichedTerms: GOTerm[] = (data.enriched_terms ?? []).map((r: Record<string, unknown>) => ({
        go_id: (r.go_id as string) ?? '',
        go_name: (r.go_name as string) ?? '',
        namespace: (r.namespace as string) ?? '',
        pvalue: (r.pvalue as number) ?? 0,
        fdr: (r.fdr as number) ?? 0,
        enrichment_ratio: (r.enrichment_ratio as number) ?? 0,
        study_count: (r.study_count as number) ?? 0,
        study_genes: (r.study_genes as string[]) ?? [],
        background_count: (r.background_count as number) ?? 0,
        level: r.level as number | undefined,
      }));

      setTerms(enrichedTerms);
      setMeta({ study_size: data.study_size, background_size: data.background_size });
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { detail?: string } }; message?: string };
      setError(anyErr?.response?.data?.detail ?? anyErr?.message ?? 'Failed to run GO enrichment');
    } finally {
      setIsRunning(false);
      setIsInitialLoad(false);
    }
  }, [dataset.id, comparisonName]);

  // On mount: check for cached GO enrichment results, auto-run if none found
  const loadCached = useCallback(async (): Promise<boolean> => {
    try {
      const res = await api.get(
        `/datasets/${dataset.id}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
        { params: { page_size: 500 } }
      );
      const rows: Record<string, unknown>[] = res.data?.pathways ?? res.data?.results ?? res.data ?? [];
      const goRows = rows.filter((r) => String(r.category ?? '').startsWith('GO:'));
      if (goRows.length > 0) {
        setTerms(goRows.map(transformCachedRow));
        setIsInitialLoad(false);
        return true;
      }
    } catch {
      // No cached results — silent fail, will auto-run fresh
    }
    return false;
  }, [dataset.id, comparisonName]);

  // Initial load: try cache first, then fresh run
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasCached = await loadCached();
      if (!hasCached && !cancelled) {
        runGOEnrichment(params);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadCached]);

  // When params change (after initial mount): debounced auto-run
  const updateParams = useCallback((next: GOEnrichmentParams) => {
    setParams(next);
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setParamsDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runGOEnrichment(next);
    }, DEBOUNCE_MS);
  }, [runGOEnrichment]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const hasResults = terms.length > 0;

  return (
    <div className="space-y-4">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">GO Enrichment</h3>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {isInitialLoad ? 'Loading…' : 'Updating…'}
            </span>
          )}
          {!isRunning && paramsDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              Applying filters…
            </span>
          )}
          {!isRunning && hasResults && !paramsDirty && (
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
            Settings
            {showSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => runGOEnrichment(params)}
            disabled={isRunning}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRunning ? 'animate-spin' : ''}`} />
            Re-run
          </Button>
        </div>
      </div>

      {/* ── Collapsible Settings ─────────────────────────────────────────── */}
      {showSettings && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">GO Namespace</Label>
                <Select
                  value={params.namespace || 'all'}
                  onValueChange={(v) => updateParams({ ...params, namespace: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All namespaces" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Namespaces</SelectItem>
                    <SelectItem value="BP">Biological Process (BP)</SelectItem>
                    <SelectItem value="MF">Molecular Function (MF)</SelectItem>
                    <SelectItem value="CC">Cellular Component (CC)</SelectItem>
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
          {/* Stats bar */}
          {meta && (
            <div className="flex items-center gap-5 px-4 py-2 bg-muted/40 rounded-lg text-xs text-muted-foreground flex-wrap">
              <span>{meta.study_size} study genes / {meta.background_size} background</span>
              <span className="text-gray-300">·</span>
              <span>{terms.filter(t => t.namespace === 'biological_process').length} BP</span>
              <span>{terms.filter(t => t.namespace === 'molecular_function').length} MF</span>
              <span>{terms.filter(t => t.namespace === 'cellular_component').length} CC</span>
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
              {activeTab === 'dotplot' && <GODotPlot terms={terms} />}
              {activeTab === 'histogram' && <EnrichmentHistogram terms={terms} />}
              {activeTab === 'radar' && (
                <EnrichmentRadarPlot
                  datasetId={dataset.id}
                  comparisonName={comparisonName}
                />
              )}
              {activeTab === 'table' && (
                <GOEnrichmentTable terms={terms} />
              )}
            </CardContent>
          </Card>

          {/* GO Hierarchy Tree */}
          <GOTreePanel
            datasetId={dataset.id}
            comparisonName={comparisonName}
            regulation={params.regulation ?? undefined}
          />
        </>
      )}

      {/* ── Empty state (loaded but no results) ─────────────────────────── */}
      {!isRunning && !error && !isInitialLoad && !hasResults && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
          <p className="text-sm font-medium mb-1">No enriched GO terms found</p>
          <p className="text-xs">Try relaxing the p-value threshold or including more DEGs via the Settings panel.</p>
        </div>
      )}
    </div>
  );
}
