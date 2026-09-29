'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dataset } from '@/types';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, ChevronDown, ChevronUp, Loader2, AlertCircle, Info } from 'lucide-react';
import GOEnrichmentTable from './GOEnrichmentTable';
import EnrichmentHistogram from './EnrichmentHistogram';
import GOTreePanel from './GOTreePanel';
import { useComparisonActions } from '@/contexts/ComparisonSelectionContext';
import { useAnalysis } from '@/hooks/useAnalyses';
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

/**
 * Every control here FILTERS the stored results; none of them re-runs the enrichment.
 *
 * The terms are computed once, during the analysis (R/annoDB on the r-worker, or the legacy
 * Python path for plain DEG uploads), and read back from the database. The panel used to offer
 * a log FC threshold, an enrichment p-value, min/max term size and a "true path rule" toggle
 * that were stored in state and read by nothing — users believed they were recomputing. Only
 * the cut-offs that can act on stored columns are left: `padj`, and the term size carried by
 * `bg_ratio` ("n/N", n = genes annotated to the term). `null` means no bound, so opening the
 * panel never hides a term by itself.
 */
interface GOEnrichmentParams {
  namespace: string | null;
  regulation: string | null;
  padjThreshold: number | null;
  minTermSize: number | null;
  maxTermSize: number | null;
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
  /** Gene set the term was enriched on: ALL significant DEGs, or only the UP / DOWN ones. */
  regulation?: string;
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
    regulation: (row.regulation as string | undefined) ?? 'ALL',
  };
}

/** Empty input = no bound. */
function parseBound(raw: string, parse: (v: string) => number): number | null {
  if (raw.trim() === '') return null;
  const n = parse(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * The regulation select picks which of the three stored enrichments is shown. "All DEGs" is the
 * enrichment on every significant DEG — not the union of the three, which listed a term up to
 * three times. A file carrying no ALL rows (only UP/DOWN) keeps showing everything under "All".
 */
function filterEnrichmentTerms(terms: GOTerm[], params: GOEnrichmentParams): GOTerm[] {
  const hasAllSet = terms.some(t => (t.regulation ?? 'ALL') === 'ALL');
  return terms.filter(t => {
    if (params.namespace && t.namespace !== params.namespace) return false;
    const reg = t.regulation ?? 'ALL';
    if (params.regulation) {
      if (reg !== params.regulation) return false;
    } else if (hasAllSet && reg !== 'ALL') {
      return false;
    }
    if (params.padjThreshold != null && !(t.fdr <= params.padjThreshold)) return false;
    if (params.minTermSize != null && t.background_count < params.minTermSize) return false;
    if (params.maxTermSize != null && t.background_count > params.maxTermSize) return false;
    return true;
  });
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
import { CHART_AXIS, CHART_GRID } from '@/components/charts/rechartsDefaults';
import {CHART_VARS } from '@/utils/chartTheme';
import { useChartPalette } from '@/utils/chartTheme';
import { cn } from '@/lib/cn';

interface DotPlotTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: GOTerm & { x: number; z: number } }>;
}

function DotPlotTooltip({ active, payload }: DotPlotTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-raised rounded-card shadow-elev-2 p-3 text-caption max-w-60">
      <div className="font-semibold text-primary mb-1 leading-snug">{d.go_name}</div>
      <div className="text-accent-ink mb-2">{d.go_id}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-secondary">
        <span>FDR</span><span className="font-semibold text-accent-ink">{d.fdr.toExponential(2)}</span>
        <span>Gene ratio</span><span className="font-semibold">{d.x.toFixed(3)}</span>
        <span>Enrichment</span><span className="font-semibold">{d.enrichment_ratio.toFixed(2)}×</span>
        <span>Genes</span><span className="font-semibold">{d.study_count}</span>
      </div>
    </div>
  );
}

function GODotPlot({ terms }: { terms: GOTerm[] }) {
  if (!terms.length) return (
    <div className="flex items-center justify-center h-48 text-body-sm text-muted">
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
      <div className="flex items-center justify-between mb-3 text-caption text-muted">
        <span>Top 20 enriched terms · Dot size = gene count · Color = -log₁₀(FDR)</span>
        <div className="flex items-center gap-1">
          <span className="inline-block w-10 h-2.5 rounded-sm" // Degrade de legende : les deux bornes venaient de la palette Tailwind
            // brute et restaient figees sur le theme clair.
            style={{ background: `linear-gradient(to right, ${CHART_VARS.accentSoft}, ${CHART_VARS.accent})` }} />
          <span>High FDR → Low FDR</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(240, top.length * 26)}>
        <ScatterChart margin={{ top: 4, right: 24, left: 8, bottom: 20 }}>
          <CartesianGrid {...CHART_GRID} />
          <XAxis
            type="number" dataKey="x" name="Gene Ratio"
            {...CHART_AXIS} tickLine={false} axisLine={false}
            label={{ value: 'Gene Ratio', position: 'insideBottom', offset: -12, fontSize: 10, fill: CHART_VARS.inkMuted }}
          />
          <YAxis
            type="category" dataKey="y" width={210}
            {...CHART_AXIS} tickLine={false} axisLine={false}
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

/**
 * Les bases de donnees sont des CATEGORIES. Elles etaient peintes par huit
 * couleurs Tailwind brutes, et la migration des statuts a laisse la liste
 * mi-brute mi-statut : « GO: Molecular Function » en SUCCES, « KEGG » en
 * AVERTISSEMENT.
 *
 * L'ordre est l'index dans la palette mesuree — les huit crans sont separes
 * sous les trois dichromaties simulees, ce que huit teintes choisies a l'oeil
 * ne garantissaient pas.
 */
const DB_CATEGORIES: { value: string; label: string }[] = [
  { value: 'GO:BP', label: 'GO: Biological Process' },
  { value: 'GO:MF', label: 'GO: Molecular Function' },
  { value: 'GO:CC', label: 'GO: Cellular Component' },
  { value: 'KEGG', label: 'KEGG Pathways' },
  { value: 'REACTOME', label: 'Reactome Pathways' },
  { value: 'HALLMARK', label: 'MSigDB Hallmark' },
  { value: 'C5_ONTOLOGY', label: 'MSigDB C5 Ontology' },
  { value: 'C7_IMMUNOLOGIC', label: 'MSigDB C7 Immunologic' },
];

export default function GOEnrichmentAnalysis({ dataset, comparisonName, enrichmentDataset }: GOEnrichmentAnalysisProps) {
  const palette = useChartPalette();
  const dbDot = (value: string) => {
    const slot = DB_CATEGORIES.findIndex((d) => d.value === value);
    return slot === -1 ? palette.ns : palette.categorical[slot % palette.categorical.length];
  };
  const { focusTerm } = useComparisonActions();
  // Pathways live on the ENRICHMENT dataset (annoDB); DEG genes on the DEG dataset.
  const enrichmentDatasetId = enrichmentDataset?.id ?? dataset.id;
  const [isRunning, setIsRunning] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [terms, setTerms] = useState<GOTerm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('dotplot');
  const [showSettings, setShowSettings] = useState(false);
  const [degGeneMap, setDegGeneMap] = useState<Record<string, DegGeneInfo>>({});

  const [params, setParams] = useState<GOEnrichmentParams>({
    namespace: null,
    regulation: null,
    padjThreshold: null,
    minTermSize: null,
    maxTermSize: null,
  });

  // The thresholds the enrichment was actually computed with: the analysis's DEG thresholds,
  // which the R step reuses. Read, not assumed — the wizard's default fold change is 1.5
  // (log2 ≈ 0.58), and the 1.0 in the worker is only a fallback. A plain upload has no analysis.
  const analysisId = (dataset.dataset_metadata?.analysis_id as string | undefined) ?? '';
  const { data: analysis } = useAnalysis(analysisId, !!analysisId);
  const computedFdr = analysis?.params?.fdr;
  // Analyses launched before the wizard sent it ran at the R script's default, 0.05.
  const computedTermFdr = analysis?.params?.enrichment_fdr ?? 0.05;
  const computedLog2fc =
    analysis?.params?.min_log2fc ?? (dataset.dataset_metadata?.min_log2fc as number | undefined);

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

  const displayTerms = filterEnrichmentTerms(terms, params);
  // Category counts follow every filter but the category itself, so each button says what
  // clicking it would show.
  const countableTerms = filterEnrichmentTerms(terms, { ...params, namespace: null });

  return (
    <div className="space-y-4">

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-primary">Pathway Enrichment</h3>
          {isRunning && (
            <span className="flex items-center gap-2 text-caption text-accent-ink">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading…
            </span>
          )}
          {!isRunning && hasResults && (
            <span className="text-caption text-success-ink bg-success-soft border border-success/30 rounded-pill px-2 py-0.5">
              {displayTerms.length} enriched terms
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 text-caption gap-2',
              showSettings ? 'text-accent-ink bg-accent-soft' : 'text-secondary',
            )}
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
              <div className="space-y-2">
                <Label className="text-caption">Database / Category</Label>
                <Select
                  value={params.namespace || 'all'}
                  onValueChange={(v) => updateParams({ ...params, namespace: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-9 text-caption"><SelectValue placeholder="All databases" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Databases</SelectItem>
                    {DB_CATEGORIES
                      .filter(db => terms.some(t => t.namespace === db.value))
                      .map(db => (
                        <SelectItem key={db.value} value={db.value}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-pill"
                              style={{ background: dbDot(db.value) }}
                              aria-hidden
                            />
                            {db.label}
                          </span>
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

              <div className="space-y-2">
                <Label className="text-caption">Regulation</Label>
                <Select
                  value={params.regulation || 'all'}
                  onValueChange={(v) => updateParams({ ...params, regulation: v === 'all' ? null : v })}
                >
                  <SelectTrigger className="h-9 text-caption"><SelectValue placeholder="All genes" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All DEGs</SelectItem>
                    <SelectItem value="UP">Upregulated Only</SelectItem>
                    <SelectItem value="DOWN">Downregulated Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="enrichment-max-padj" className="text-caption">Show terms with adj. p-value ≤</Label>
                <Input
                  id="enrichment-max-padj"
                  className="h-9 text-caption"
                  type="number" step="0.001" min="0" max="1"
                  placeholder="Any"
                  value={params.padjThreshold ?? ''}
                  onChange={(e) => updateParams({ ...params, padjThreshold: parseBound(e.target.value, parseFloat) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="enrichment-min-term-size" className="text-caption">Min term size (annotated genes)</Label>
                <Input
                  id="enrichment-min-term-size"
                  className="h-9 text-caption"
                  type="number" min="1" step="1"
                  placeholder="Any"
                  value={params.minTermSize ?? ''}
                  onChange={(e) => updateParams({ ...params, minTermSize: parseBound(e.target.value, (v) => parseInt(v, 10)) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrichment-max-term-size" className="text-caption">Max term size (annotated genes)</Label>
                <Input
                  id="enrichment-max-term-size"
                  className="h-9 text-caption"
                  type="number" min="1" step="1"
                  placeholder="Any"
                  value={params.maxTermSize ?? ''}
                  onChange={(e) => updateParams({ ...params, maxTermSize: parseBound(e.target.value, (v) => parseInt(v, 10)) })}
                />
              </div>
            </div>

            <p className="flex items-start gap-2 text-caption text-muted">
              <Info className="w-3.5 h-3.5 mt-1 shrink-0" aria-hidden />
              <span>
                {computedFdr != null && computedLog2fc != null
                  ? `Enrichment was computed during the analysis on DEGs at FDR ${computedFdr} and |log2FC| ≥ ${Number(computedLog2fc.toFixed(2))}, keeping terms with adj. p-value < ${computedTermFdr}. These filters narrow the stored terms; they do not re-run it.`
                  : 'Enrichment was computed when the results were produced. These filters narrow the stored terms; they do not re-run it.'}
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-sm text-body-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-1 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Loading skeleton (first load) ────────────────────────────────── */}
      {isInitialLoad && isRunning && (
        <div className="space-y-3 animate-pulse">
          <div className="h-9 bg-surface-2 rounded-control" />
          <div className="h-64 bg-surface-2 rounded-card" />
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Stats bar — dynamic: shows all categories present in results */}
          {terms.length > 0 && (
            <div className="flex items-center gap-6 px-4 py-2 bg-surface-2 rounded-control text-caption text-muted flex-wrap">
              {[...new Set(terms.map(t => t.namespace).filter(Boolean))].map(cat => {
                const count = countableTerms.filter(t => t.namespace === cat).length;
                const dbDef = DB_CATEGORIES.find(db => db.value === cat);
                return (
                  <button
                    key={cat}
                    onClick={() => updateParams({ ...params, namespace: params.namespace === cat ? null : cat })}
                    className={cn(
                      'transition-colors',
                      params.namespace === cat ? 'font-semibold text-foreground' : 'hover:text-foreground',
                    )}
                  >
                    {count} {dbDef ? dbDef.label.replace(/^(GO: |MSigDB )/, '') : cat}
                  </button>
                );
              })}
            </div>
          )}

          {/* Visualization tabs */}
          <Card className={isRunning ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
            <div className="flex border-b border-subtle bg-surface-2 rounded-t-card overflow-hidden">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-5 py-2.5 text-caption font-semibold border-b-2 transition-colors',
                    activeTab === tab.id ? 'text-accent-ink border-accent bg-surface' : 'text-muted border-transparent hover:text-secondary',
                  )}
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
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted bg-surface-2 rounded-card border border-dashed">
          <p className="text-body-sm font-medium mb-1">No enriched terms found</p>
          <p className="text-caption">Enrichment analysis has not been computed yet for this comparison.</p>
        </div>
      )}
    </div>
  );
}
