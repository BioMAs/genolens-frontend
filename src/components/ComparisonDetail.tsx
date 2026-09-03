'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { DatasetStatus } from '@/types';
import { ArrowLeft, Database, Download, Lock } from 'lucide-react';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useQueryClient } from '@tanstack/react-query';
import DEGBarChart from './DEGBarChart';
import Link from 'next/link';
import VolcanoPanel from './comparison/explorer/VolcanoPanel';
import SelectionCard from './comparison/explorer/SelectionCard';
import GeneListDeepLink from './comparison/explorer/GeneListDeepLink';
import DEGTable from './DEGTable';
import MethodStatsPanel from './MethodStatsPanel';
import AIInterpretationPanel from './AIInterpretationPanel';
import CustomVisualizationPanel from './CustomVisualizationPanel';
import SignatureScorePanel from './SignatureScorePanel';
import DrugDiscoveryComparisonPanel from './tools/dd/DrugDiscoveryComparisonPanel';
import ExportMenu from './ExportMenu';
import ReportCustomizationPanel from './report/ReportCustomizationPanel';
import PPINetworkSection from './network/PPINetworkSection';
import StringEnrichmentPanel from './integrations/StringEnrichmentPanel';
import ClusteringAnalysis from './analysis/ClusteringAnalysis';
import DEGClusteringView from './analysis/DEGClusteringView';
import GOEnrichmentAnalysis from './GOEnrichmentAnalysis';
import GSEAAnalysis from './GSEAAnalysis';
import CosmeticsTab from './cosmetics/CosmeticsTab';
import { useUserProfile } from '@/hooks/useCosmetics';
import ComparisonSynthesis from './comparison/ComparisonSynthesis';
import ComparisonModuleGrid from './comparison/ComparisonModuleGrid';
import OverviewTopPathways from './comparison/OverviewTopPathways';
import { buildComparisonModules } from './comparison/comparisonModules';
import { useComparisonContext } from './comparison/useComparisonContext';
import ComparisonHeader from './comparison/ComparisonHeader';
import SectionRail, { type RailEntry } from './comparison/SectionRail';
import { useEnrichmentMode, GSEA_HASH } from './comparison/useEnrichmentMode';
import { useMountOnIntersection } from '@/hooks/useMountOnIntersection';
import {
  resolveView,
  upgradeLegacyQuery,
  VIEW_DESCRIPTIONS,
  VIEW_LABELS,
  type ComparisonPanel,
  type ComparisonView,
} from './comparison/comparisonRoutes';
import SynthesisStrip from './comparison/explorer/SynthesisStrip';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';

interface ComparisonDetailProps {
  projectId: string;
  comparisonName: string;
  analysisId?: string;
}

type GenericRow = Record<string, unknown>;


/**
 * Stands in for a section that has not been mounted yet.
 *
 * Not a spinner: nothing is loading. It reserves the height so the rail's anchors do not jump
 * as sections arrive, names what will appear, and offers to build it now for anyone who would
 * rather not scroll.
 */
function SectionPlaceholder({ label, onReveal }: { label: string; onReveal: () => void }) {
  return (
    <div
      className="flex min-h-40 flex-col items-center justify-center gap-2 text-center"
      style={{
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-panel)',
        color: 'var(--text-muted)',
      }}
    >
      <p className="text-sm">{label}</p>
      <button
        type="button"
        onClick={onReveal}
        className="text-xs underline"
        style={{ color: 'var(--sl-teal-dark)' }}
      >
        Load this section
      </button>
    </div>
  );
}

/**
 * Thresholds and, later, the gene selection are shared by every pane of this screen, so the
 * provider sits above the pane switch — mounted inside a pane, the state would reset on every
 * tab change.
 */
export default function ComparisonDetail(props: ComparisonDetailProps) {
  return (
    <ComparisonSelectionProvider>
      <ComparisonDetailInner {...props} />
    </ComparisonSelectionProvider>
  );
}

function ComparisonDetailInner({ projectId, comparisonName, analysisId }: ComparisonDetailProps) {
  const searchParams = useSearchParams();
  const globalDatasetId = searchParams.get('datasetId');
  const { openChatWith } = useChatMode();
  const queryClient = useQueryClient();

  // The open screen IS the URL — no local copy to keep in sync. Derived during render, not
  // redirected in an effect: a cold `?tab=enrichment` link must paint Understand on the first
  // frame, where an effect-based redirect would flash Explore first.
  const activeView: ComparisonView = resolveView(searchParams);

  /** Switches screen through the URL, without a server round-trip. */
  const selectView = useCallback((view: ComparisonView, panel?: ComparisonPanel) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    if (view === 'explorer') url.searchParams.delete('view');
    else url.searchParams.set('view', view);
    url.hash = panel ? `#${panel}` : '';
    // Native history update: useSearchParams reflects it (Next.js ≥ 14.1), so this re-renders
    // the page without refetching it. replaceState, not push: switching screens shouldn't
    // pile up history entries.
    window.history.replaceState(null, '', url.toString());
  }, []);

  // Cosmetic only: the right screen is already rendering, thanks to the derivation above. This
  // just rewrites an old link to the current contract so the address bar stops advertising a
  // parameter that no longer exists.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = new URLSearchParams(window.location.search);
    const upgraded = upgradeLegacyQuery(current);
    if (upgraded === null) return;
    const url = `${window.location.pathname}${upgraded ? `?${upgraded}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  }, [searchParams]);


  // Add-on module gating: render a module's section only when it is unlocked (admins keep
  // full access by role; otherwise the explicit per-user flag). A locked module appears as a
  // locked card under Tools, where access can be requested.
  const { data: moduleProfile } = useUserProfile();
  const isModuleAdmin =
    moduleProfile?.role === 'ADMIN' || moduleProfile?.role === 'SCILICIUM_ADMIN';
  const cosmeticsUnlocked =
    !!moduleProfile && (isModuleAdmin || moduleProfile.has_cosmetics_module === true);
  const reportCustomizationUnlocked =
    !!moduleProfile && (isModuleAdmin || moduleProfile.has_report_customization === true);
  const scientificUnlocked =
    !!moduleProfile && (isModuleAdmin || moduleProfile.has_scientific_module === true);
  const drugDiscoveryUnlocked =
    !!moduleProfile && (isModuleAdmin || moduleProfile.has_drug_discovery_module === true);
  // No redirect for a locked add-on any more. `?tab=cosmetics` resolves to Tools, where the
  // locked card and its "Request access" action actually live, and a screen is a group of
  // sections rather than a single pane — so a locked module simply does not render its own
  // section instead of leaving the whole view blank. That is strictly better than the previous
  // behaviour, which bounced such a link to an empty overview.

  // Over-representation or ranked GSEA, read from the fragment so a GSEA result is linkable.
  // The add-on guard lives in the hook, which is why the effect that used to force it back is
  // gone: the mode is simply never 'gsea' for a user without the module.
  const [enrichmentMode, setEnrichmentMode] = useEnrichmentMode(scientificUnlocked);

  /**
   * All the comparison's data, resolved once. The resolution chain moved out verbatim: the
   * scoping to `analysisId` records a real bug fix, and every lookup prefers a READY dataset.
   */
  const {
    project,
    decodedName,
    actualComparisonName,
    degDataset,
    enrichmentDataset,
    matrixDataset,
    samples,
    geneMap,
    isLoading: loading,
    isError,
  } = useComparisonContext({ projectId, comparisonName, analysisId, globalDatasetId });

  // Kept under their previous names so the panels below are untouched by this extraction.
  const relevantSamples = samples.sampleIds;
  const sampleConditionMap = samples.conditionMap;
  const allMatrixGenes = geneMap.genes;

  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  // Still here on purpose: this effect does not only read, it `api.patch`es the computed
  // statistics back onto the dataset. That write-on-read has to become an explicit mutation
  // before it can move into a hook, which is a ticket of its own.
  const [stats, setStats] = useState<{degUp: number, degDown: number, degTotal: number, genesTested?: number} | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const handleReprocessDEG = async () => {
    if (!degDataset) return;

    try {
      setReprocessing(true);
      await api.post(`/datasets/${degDataset.id}/reprocess`);

      let pollCount = 0;
      const maxPolls = 120; // 120 * 5s = 10 minutes max

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          pollCount++;
          const resp = await api.get(`/datasets/${degDataset.id}`);

          if (resp.data.status === DatasetStatus.READY) {
            clearInterval(pollInterval);
            // Invalidate rather than re-fetch by hand: the datasets query is shared with the
            // sidebar, so one invalidation refreshes both.
            queryClient.invalidateQueries({ queryKey: ['datasets', 'project', projectId] });
            setReprocessing(false);
          } else if (resp.data.status === DatasetStatus.FAILED) {
            clearInterval(pollInterval);
            setReprocessing(false);
            setReprocessError('Heatmap regeneration failed');
          } else if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            setReprocessing(false);
            setReprocessError('Heatmap regeneration timed out after 10 minutes');
          }
        } catch (err: unknown) {
          // Ignore ECONNABORTED errors during polling
          const errorCode = (err as { code?: string } | null)?.code;
          if (errorCode !== 'ECONNABORTED') {
            console.error('Polling error:', err);
          }
        }
      }, 5000); // Poll every 5 seconds

    } catch (err) {
      console.error('Failed to reprocess dataset:', err);
      setReprocessing(false);
      setReprocessError('Failed to start heatmap regeneration');
    }
  };



  // Calculate or fetch statistics from DEG dataset
  useEffect(() => {
    if (!degDataset) return;

    const metadata = degDataset.dataset_metadata as Record<string, unknown> | undefined;
    const toNumber = (value: unknown): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };
    const comparisons =
      metadata?.comparisons && typeof metadata.comparisons === 'object' && !Array.isArray(metadata.comparisons)
        ? (metadata.comparisons as Record<string, Record<string, unknown>>)
        : undefined;

    // Check if stats already exist in metadata
    if (metadata?.deg_up !== undefined && metadata?.deg_down !== undefined) {
      const degUp = toNumber(metadata.deg_up);
      const degDown = toNumber(metadata.deg_down);
      const degTotal = metadata.deg_total !== undefined ? toNumber(metadata.deg_total) : degUp + degDown;

      // Stats exist at top level (for individual comparison datasets)
      setStats({
        degUp,
        degDown,
        degTotal,
        genesTested: metadata.deg_tested !== undefined ? toNumber(metadata.deg_tested) : undefined,
      });
      return;
    }

    if (globalDatasetId && comparisons?.[decodedName]) {
      const compData = comparisons[decodedName];
      if (compData.deg_up !== undefined && compData.deg_down !== undefined) {
        // Stats exist in comparisons metadata (for global DEG files)
        setStats({
          degUp: toNumber(compData.deg_up),
          degDown: toNumber(compData.deg_down),
          degTotal: toNumber(compData.deg_total),
          genesTested: compData.deg_tested !== undefined ? toNumber(compData.deg_tested) : undefined,
        });
        return;
      }
    }

    // Stats don't exist - fetch them using optimized endpoint
    const fetchStatsFromAPI = async () => {
      setStatsLoading(true);
      try {
        // OPTIMIZATION: Use new /stats endpoint instead of fetching 100K rows
        // Old: Fetch 100K rows + calculate in JavaScript (5-15 MB + 1-2s CPU)
        // New: Backend calculates stats (<1 KB, <500ms)
        const response = await api.get(`/datasets/${degDataset.id}/stats`, {
          params: globalDatasetId ? { comparison_name: decodedName } : {}
        });

        const { up_genes, down_genes, total_genes, significant_genes } = response.data;
        
        // Convert to expected format
        const newStats = {
          degUp: up_genes || 0,
          degDown: down_genes || 0,
          degTotal: significant_genes || total_genes || 0,
          // Denominator of the response — shown as "of N genes tested".
          genesTested: typeof total_genes === 'number' ? total_genes : undefined,
        };
        
        setStats(newStats);

        // Save statistics back to database metadata for future use
        const updatedMetadata = globalDatasetId
          ? {
              comparisons: {
                ...comparisons,
                [decodedName]: {
                  ...comparisons?.[decodedName],
                  deg_up: newStats.degUp,
                  deg_down: newStats.degDown,
                  deg_total: newStats.degTotal,
                  deg_tested: newStats.genesTested
                }
              }
            }
          : {
              ...metadata,
              deg_up: newStats.degUp,
              deg_down: newStats.degDown,
              deg_total: newStats.degTotal,
              deg_tested: newStats.genesTested
            };

        await api.patch(`/datasets/${degDataset.id}`, {
          dataset_metadata: updatedMetadata
        });

        console.log('DEG statistics fetched and saved:', newStats);
        setStatsLoading(false);
      } catch (err) {
        console.error('Failed to fetch DEG statistics from API:', err);
        // Fallback to old computation method
        await computeAndSaveStatsLegacy();
      }
    };

    // Legacy fallback computation method (kept for compatibility)
    const computeAndSaveStatsLegacy = async () => {
      setStatsLoading(true);
      try {
        // Query the dataset to get all DEG data
        const response = await api.post(`/datasets/${degDataset.id}/query`, {
          limit: 100000 // Get all genes
        });

        const data = response.data.data;
        const columns = response.data.columns;

        // Find the relevant columns for this comparison
        let logFCCol: string | null = null;
        let padjCol: string | null = null;

        // For global dataset, find columns for this comparison
        if (globalDatasetId) {
          const compData = comparisons?.[decodedName];
          logFCCol = typeof compData?.logFC === 'string' ? compData.logFC : null;
          padjCol = typeof compData?.padj === 'string' ? compData.padj : null;
        } else {
          // For individual comparison dataset, find any logFC/padj columns
          logFCCol = columns.find((c: string) =>
            c.includes('log2FoldChange') || c.includes('logFC')
          ) || null;
          padjCol = columns.find((c: string) =>
            c.includes('padj') || c.includes('adj.P.Val') || c.includes('FDR')
          ) || null;
        }

        if (!logFCCol || !padjCol) {
          console.warn('Could not find logFC or padj columns');
          setStats({ degUp: 0, degDown: 0, degTotal: 0 });
          return;
        }

        // Calculate statistics using EXACT same logic as DEG table
        // Check if contrast column exists
        const contrastCol = `contrast:${decodedName}`;
        const hasContrastCol = columns.includes(contrastCol);

        console.log('[ComparisonDetail] Contrast column:', contrastCol, 'Found:', hasContrastCol);

        let degUp = 0;
        let degDown = 0;
        let degTotal = 0;

          if (hasContrastCol) {
          // Use contrast column to count (matches DEG table logic exactly)
            (Array.isArray(data) ? data : []).forEach((row: GenericRow) => {
            const contrastValue = row[contrastCol];

            // Only count rows with non-empty contrast values
            if (contrastValue && contrastValue !== '' && contrastValue !== null) {
              const upperValue = String(contrastValue).toUpperCase();
              if (upperValue === 'UP') {
                degUp++;
                degTotal++;
              } else if (upperValue === 'DOWN') {
                degDown++;
                degTotal++;
              }
            }
          });
        } else {
          // Fallback: use logFC sign (old method)
          const logFCThreshold = 0.58;
          const padjThreshold = 0.05;

            const logFCCol = columns.find((c: string) => c.includes('log2FoldChange') || c.includes('logFC'));
            const padjCol = columns.find((c: string) => c.includes('padj') || c.includes('adj.P.Val') || c.includes('FDR'));

            if (!logFCCol || !padjCol) {
              setStats({ degUp: 0, degDown: 0, degTotal: 0 });
              return;
            }

            (Array.isArray(data) ? data : []).forEach((row: GenericRow) => {
              const logFC = Number(row[logFCCol]);
              const padj = Number(row[padjCol]);

            // Filter: padj < 0.05 AND |logFC| > 0.58
              if (Number.isFinite(logFC) && Number.isFinite(padj) && padj < padjThreshold && Math.abs(logFC) > logFCThreshold) {
              degTotal++;
              if (logFC > 0) {
                degUp++;
              } else {
                degDown++;
              }
            }
          });
        }

        console.log('[ComparisonDetail] Calculated stats:', { degUp, degDown, degTotal });

        const newStats = {
          degUp,
          degDown,
          degTotal,
          genesTested: Array.isArray(data) ? data.length : undefined,
        };
        setStats(newStats);

        // Save statistics back to database
        const updatedMetadata = globalDatasetId
          ? {
              comparisons: {
                ...comparisons,
                [decodedName]: {
                  ...comparisons?.[decodedName],
                  deg_up: degUp,
                  deg_down: degDown,
                  deg_total: degTotal,
                  deg_tested: newStats.genesTested
                }
              }
            }
          : {
              ...metadata,
              deg_up: degUp,
              deg_down: degDown,
              deg_total: degTotal,
              deg_tested: newStats.genesTested
            };

        await api.patch(`/datasets/${degDataset.id}`, {
          dataset_metadata: updatedMetadata
        });

        console.log('DEG statistics calculated and saved:', newStats);
      } catch (err) {
        console.error('Failed to compute DEG statistics:', err);
        setStats({ degUp: 0, degDown: 0, degTotal: 0 });
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStatsFromAPI();
  }, [degDataset, decodedName, globalDatasetId]);

  // What this comparison offers, and why a module is out of reach.
  // The two heavy panels of Understand: one builds a hand-rolled SVG over a STRING round-trip,
  // the other asks for a per-sample scoring. Behind a tab they mounted on click; on a merged
  // screen they would mount on arrival, so they wait until they are scrolled near.
  // Destructured, not held as an object: the React compiler rule reads a member access on a
  // hook result that feeds a `ref` prop as a ref access during render.
  const {
    attach: attachNetwork,
    visible: networkVisible,
    reveal: revealNetwork,
  } = useMountOnIntersection<HTMLDivElement>();
  const {
    attach: attachSignature,
    visible: signatureVisible,
    reveal: revealSignature,
  } = useMountOnIntersection<HTMLDivElement>();

  const comparisonModules = useMemo(
    () =>
      buildComparisonModules({
        hasMatrix: !!matrixDataset,
        hasEnrichmentFile: !!enrichmentDataset,
        cosmeticsUnlocked,
        reportUnlocked: reportCustomizationUnlocked,
        scienceUnlocked: scientificUnlocked,
        drugDiscoveryUnlocked,
        stats,
      }),
    [
      matrixDataset,
      enrichmentDataset,
      cosmeticsUnlocked,
      reportCustomizationUnlocked,
      scientificUnlocked,
      drugDiscoveryUnlocked,
      stats,
    ]
  );

  /** Sections of the open screen, for the rail. Only what actually renders. */
  const railEntries = useMemo<RailEntry[]>(
    () =>
      comparisonModules
        .filter((m) => m.view === activeView && m.state === 'ready')
        .map((m) => ({ panel: m.panel, label: m.title })),
    [comparisonModules, activeView]
  );


  if (loading) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Loading…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Failed to load comparison details.
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
        Project not found
      </div>
    );
  }

  if (!degDataset) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
          </Link>
          <div className="bg-yellow-50 p-4 rounded-md mt-4">
            <p className="text-yellow-700">No Differential Expression (DEG) dataset found for this comparison.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <ComparisonHeader
        projectId={projectId}
        analysisId={analysisId}
        project={project}
        degDataset={degDataset}
        decodedName={decodedName}
        actualComparisonName={actualComparisonName}
        stats={stats}
        statsLoading={statsLoading}
        reportUnlocked={reportCustomizationUnlocked}
        reprocessing={reprocessing}
        onReprocess={handleReprocessDEG}
        onOpenChat={() =>
          openChatWith({
            projectId,
            datasetId: degDataset.id,
            comparisonName: actualComparisonName,
          })
        }
      />

      {reprocessError ? (
        <p className="mt-2 text-sm" style={{ color: 'var(--sl-red)' }}>
          {reprocessError}
        </p>
      ) : null}

      {/* The synthesis is true of every screen, so it sits above them rather than inside one —
          which is also what dissolves the old overview view. */}
      <div className="mt-4">
        <ComparisonSynthesis
          comparisonName={decodedName}
          stats={stats}
          sampleConditionMap={sampleConditionMap}
          loading={statsLoading}
        />
      </div>

      {/* One screen at a time; within it, anchored sections rather than exclusive panes. */}
      <div className="mt-4 gl-card overflow-hidden">
          <div className="p-5 space-y-8">
            <div>
              <h2 className="font-display text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {VIEW_LABELS[activeView]}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {VIEW_DESCRIPTIONS[activeView]}
              </p>
            </div>

            <SectionRail entries={railEntries} viewKey={activeView} />

            {/* ── Explore ───────────────────────────────────────────────── */}
            {activeView === 'explorer' && (
              <section id="summary" className="scroll-mt-24">
                {/* The two arrival questions, kept adjacent as the overview had them:
                    which genes moved, and what they do. */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <DEGBarChart dataset={degDataset} comparisonName={actualComparisonName} />
                  <OverviewTopPathways
                    enrichmentDataset={enrichmentDataset}
                    comparisonName={actualComparisonName}
                    onOpenEnrichment={() => selectView('comprendre', 'enrichment')}
                  />
                </div>
              </section>
            )}

            {activeView === 'explorer' && (
              <section id="genes" className="scroll-mt-24 space-y-6">
                {/* One significance control for the whole pane, with the counts it produces. */}
                <SynthesisStrip
                  datasetId={degDataset.id}
                  comparisonName={actualComparisonName}
                />

                {/* Volcano plot — the whole comparison at a glance, next to the
                    table it filters down to. */}
                <div className="gl-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Volcano plot
                    </h2>
                    <Link
                      href={`/projects/${projectId}/datasets/${degDataset.id}`}
                      className="text-xs font-semibold"
                      style={{ color: 'var(--sl-teal-dark)' }}
                    >
                      View dataset
                    </Link>
                  </div>

                  {/* The plot takes the room; the card stays beside it and fills from
                      whatever is selected. The legend lives in the panel itself now, so the
                      dot row that used to duplicate it is gone. */}
                  {/* Resolves a ?geneList= link into the shared selection. Renders nothing. */}
                  <GeneListDeepLink projectId={projectId} />

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <VolcanoPanel dataset={degDataset} comparisonName={actualComparisonName} />
                    <SelectionCard
                      dataset={degDataset}
                      comparisonName={actualComparisonName}
                      matrixDataset={matrixDataset}
                      enrichmentDataset={enrichmentDataset}
                      sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                      conditionBySample={
                        Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined
                      }
                      geneNameMap={geneMap.nameByGene}
                    />
                  </div>
                </div>

                {/* DEG Table */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Differentially Expressed Genes</h2>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700"
                      onClick={async () => {
                        try {
                          const response = await api.get(
                            `/datasets/${degDataset.id}/deg-stats/export`,
                            {
                              params: { comparison: actualComparisonName },
                              responseType: 'blob',
                            }
                          );
                          const url = URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `deg_stats_${actualComparisonName}.csv`;
                          link.click();
                          URL.revokeObjectURL(url);
                        } catch (e) {
                          console.error('DEG stats download failed', e);
                        }
                      }}
                    >
                      <Download className="w-4 h-4" />
                      Download DEG — per-method p-values (.csv)
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Browse all differentially expressed genes with filtering and sorting capabilities.</p>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <DEGTable dataset={degDataset} comparisonName={actualComparisonName} />
                  </div>
                </div>
              </section>
            )}

            {/* Method statistics (per-method p-values + Stouffer) */}
            {activeView === 'explorer' && (
              <section id="methods" className="scroll-mt-24">
                <MethodStatsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
              </section>
            )}

            {/* ── Understand ────────────────────────────────────────────── */}
            {activeView === 'comprendre' && (
              <section id="ai" className="scroll-mt-24">
                {/* The AI reading opens the screen: the synthesis above gives the numbers,
                    this says what they mean, and the sections below are the evidence. */}
                <AIInterpretationPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
              </section>
            )}

            {activeView === 'comprendre' && (
              <section id="enrichment" className="scroll-mt-24">
              {degDataset ? (
                <div className="space-y-4">
                  {/* Sub-mode toggle: over-representation vs ranked GSEA. It carries the
                      #gsea anchor itself, so the fragment always has something to land on. */}
                  <div
                    id={GSEA_HASH}
                    className="inline-flex scroll-mt-32 rounded-lg p-1"
                    style={{ background: 'var(--surface-secondary)', border: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={() => setEnrichmentMode('ora')}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                        enrichmentMode === 'ora'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Over-representation (ORA)
                    </button>
                    {scientificUnlocked ? (
                      <button
                        onClick={() => setEnrichmentMode('gsea')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                          enrichmentMode === 'gsea'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        GSEA (ranked)
                      </button>
                    ) : (
                      <span
                        title="GSEA is part of the Scientific tools add-on — request access from the comparison overview"
                        className="inline-flex cursor-not-allowed items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-gray-400"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        GSEA (ranked)
                      </span>
                    )}
                  </div>

                  {enrichmentMode === 'ora' ? (
                    <GOEnrichmentAnalysis
                      dataset={degDataset}
                      enrichmentDataset={enrichmentDataset}
                      comparisonName={actualComparisonName}
                    />
                  ) : scientificUnlocked ? (
                    <GSEAAnalysis
                      dataset={degDataset}
                      comparisonName={actualComparisonName}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No DEG data</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Enrichment requires a DEG dataset associated with this comparison.
                  </p>
                </div>
              )}
              </section>
            )}

            {/* ── Tools ─────────────────────────────────────────────────── */}
            {activeView === 'outils' && cosmeticsUnlocked && (
              <section id="cosmetics" className="scroll-mt-24">
                <CosmeticsTab
                  datasetId={degDataset?.id}
                  comparisonName={actualComparisonName}
                />
              </section>
            )}

            {/* ── Share ─────────────────────────────────────────────────── */}
            {activeView === 'partager' && (
              <section id="exports" className="scroll-mt-24 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Exports
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    The gene table of this comparison, and its per-method p-values.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ExportMenu
                    filename={`${actualComparisonName}_comparison`}
                    formats={['csv', 'json']}
                    variant="outline"
                    size="sm"
                  />
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--text-secondary)',
                    }}
                    onClick={async () => {
                      try {
                        const response = await api.get(
                          `/datasets/${degDataset.id}/deg-stats/export`,
                          { params: { comparison: actualComparisonName }, responseType: 'blob' }
                        );
                        const url = URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `deg_stats_${actualComparisonName}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                      } catch (e) {
                        console.error('DEG stats download failed', e);
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Per-method p-values (.csv)
                  </button>
                </div>
              </section>
            )}

            {activeView === 'partager' && reportCustomizationUnlocked && (
              <section id="report" className="scroll-mt-24">
                <ReportCustomizationPanel />
              </section>
            )}

            {/* Heatmap & clustering */}
            {activeView === 'explorer' && (
              <section id="heatmap" className="scroll-mt-24">
              {matrixDataset && degDataset ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Heatmap — DEG Genes</h2>
                    <p className="text-sm text-gray-600 mb-4">
                      Visualization of differentially expressed genes (DEGs) for the samples in this comparison only.
                    </p>
                    <DEGClusteringView
                      degDataset={degDataset}
                      matrixDataset={matrixDataset}
                      sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                      comparisonName={actualComparisonName}
                      sampleConditionMap={Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined}
                    />
                  </div>
                </div>
              ) : matrixDataset ? (
                <ClusteringAnalysis
                  projectId={projectId}
                  datasetId={matrixDataset.id}
                  datasetName={matrixDataset.name}
                />
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No expression matrix</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Clustering requires an expression matrix (count matrix).
                    Upload a matrix of type &quot;Expression Matrix&quot; to enable this view.
                  </p>
                </div>
              )}
              </section>
            )}

            {activeView === 'comprendre' && (
              <section id="network" className="scroll-mt-24" ref={attachNetwork}>
                {networkVisible ? (
                  <PPINetworkSection
                    dataset={degDataset}
                    comparisonName={actualComparisonName}
                  />
                ) : (
                  <SectionPlaceholder label="Interaction network" onReveal={revealNetwork} />
                )}
              </section>
            )}

            {/* Signature scoring */}
            {activeView === 'comprendre' && scientificUnlocked && (
              <section id="signature" className="scroll-mt-24" ref={attachSignature}>
              {!signatureVisible ? (
                <SectionPlaceholder label="Signature score" onReveal={revealSignature} />
              ) : matrixDataset ? (
                <SignatureScorePanel
                  projectId={projectId}
                  matrixDatasetId={matrixDataset.id}
                  samples={relevantSamples.length > 0 ? relevantSamples : undefined}
                  sampleConditionMap={Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined}
                />
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No expression matrix</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Signature scoring requires an expression matrix (count matrix) for this project.
                  </p>
                </div>
              )}
              </section>
            )}

            {/* Drug targets — la comparaison face au classement de cibles (mode B) */}
            {activeView === 'outils' && drugDiscoveryUnlocked && (
              <section id="drug-discovery" className="scroll-mt-24">
              {degDataset ? (
                /* `actualComparisonName` et non `decodedName` : c'est la clé stockée, et celle
                   que porte `deg_genes.comparison_name` côté base. */
                <DrugDiscoveryComparisonPanel
                  datasetId={degDataset.id}
                  comparisonName={actualComparisonName}
                />
              ) : (
                <div className="text-center py-16">
                  <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No DEG results</h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Drug target scoring is built from the differentially expressed genes of this
                    comparison, so it needs the DEG results to be available.
                  </p>
                </div>
              )}
              </section>
            )}

            {activeView === 'outils' && (
              <section id="external-lookup" className="scroll-mt-24">
                <StringEnrichmentPanel />
              </section>
            )}

            {/* The whole catalogue, so a locked add-on stays requestable and every screen
                remains discoverable from one place. */}
            {activeView === 'outils' && (
              <section id="catalogue" className="scroll-mt-24">
                <ComparisonModuleGrid
                  modules={comparisonModules}
                  onOpen={(view, panel) => selectView(view, panel)}
                />
              </section>
            )}

            {/* Custom Visualizations — a valid ?tab= value nothing ever linked to, until now */}
            {activeView === 'outils' && (
              <section id="custom-viz" className="scroll-mt-24">
                <CustomVisualizationPanel
                  datasetId={degDataset.id}
                  comparisonName={actualComparisonName}
                  allGenes={allMatrixGenes}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    );
    }

