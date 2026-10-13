'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/utils/api';
import { DatasetStatus } from '@/types';
import { ArrowLeft, Database, Download } from 'lucide-react';
import { useChatMode } from '@/contexts/ChatModeContext';
import { useQueryClient } from '@tanstack/react-query';
import DEGBarChart from './DEGBarChart';
import Link from 'next/link';
import VolcanoPanel from './comparison/explorer/VolcanoPanel';
import SelectionCard from './comparison/explorer/SelectionCard';
import GeneListDeepLink from './comparison/explorer/GeneListDeepLink';
import HeatmapSection from './comparison/explorer/HeatmapSection';
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
import GOEnrichmentAnalysis from './GOEnrichmentAnalysis';
import GSEAAnalysis from './GSEAAnalysis';
import CosmOmicsPanel from './cosmomics/CosmOmicsPanel';
import { useUserProfile } from '@/hooks/useUserProfile';
import ComparisonSynthesis from './comparison/ComparisonSynthesis';
import ComparisonModuleDisclosure from './comparison/ComparisonModuleDisclosure';
import ComparisonViewHub from './comparison/ComparisonViewHub';
import OverviewTopPathways from './comparison/OverviewTopPathways';
import { buildComparisonModules, groupModulesByView } from './comparison/comparisonModules';
import { useComparisonContext } from './comparison/useComparisonContext';
import ComparisonHeader from './comparison/ComparisonHeader';
import { SegmentedControl } from '@/components/ui/tabs';
import { buttonClasses } from '@/components/ui/button';
import ModuleTabs, { MODULE_TABS_ID, moduleTabId } from './comparison/ModuleTabs';
import PathwayFocusBar from './comparison/comprendre/PathwayFocusBar';
import { useEnrichmentMode, GSEA_HASH } from './comparison/useEnrichmentMode';
import { useDeferredAnchorScroll } from '@/hooks/useDeferredAnchorScroll';
import { useLocationHash } from '@/hooks/useLocationHash';
import { useSignificanceSummary } from '@/hooks/useSignificanceSummary';
import { DEG_EXPORT_COLUMNS, fetchAllDegGenes, toDegExportRow } from '@/hooks/useDegGenes';
import {
  PANEL_PARAM,
  VIEW_LABELS,
  resolveRequestedPanel,
  resolveView,
  upgradeLegacyQuery,
  type ComparisonPanel,
  type ComparisonView,
} from './comparison/comparisonRoutes';
import SynthesisStrip from './comparison/explorer/SynthesisStrip';
import {
  ComparisonSelectionProvider,
  useComparisonActions,
  useFocusedTerm,
  useThresholds,
} from '@/contexts/ComparisonSelectionContext';

interface ComparisonDetailProps {
  projectId: string;
  comparisonName: string;
  analysisId?: string;
}

/**
 * What every module's `<section>` carries: it is the panel of its tab.
 *
 * Spread after a literal `id="…"` on purpose — `ComparisonSidebarNav.test` reads this file and
 * matches `<section id="…"` to prove that every catalogue module has a panel here.
 */
const tabPanel = (panel: ComparisonPanel) => ({
  role: 'tabpanel' as const,
  'aria-labelledby': moduleTabId(panel),
  tabIndex: 0,
});

/** The fragment of a URL, kept only when it is the GSEA sub-state of the enrichment module. */
const modeHash = (hash: string) => (hash === `#${GSEA_HASH}` ? hash : '');

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

  // The module the URL asks for — `?panel=`, else an old `?tab=` or `#anchor`. Whether it is a
  // tab of this screen is settled below, once the catalogue is known.
  const hash = useLocationHash();
  const requestedPanel = resolveRequestedPanel(searchParams, hash);

  /** Switches screen through the URL, without a server round-trip. */
  const { selectGenes, focusTerm } = useComparisonActions();
  const focusedTerm = useFocusedTerm();

  // "Open this module" from a card or a link inside another module brings the tabs into view —
  // the request comes from wherever the reader was, often far below. Retried against
  // `activeView` because crossing screens re-renders the tab list one pass later.
  const requestScroll = useDeferredAnchorScroll(activeView);

  /**
   * Opens a screen, on one of its modules or on its first one.
   *
   * Native history update: useSearchParams reflects it (Next.js ≥ 14.1), so this re-renders the
   * page without refetching it. replaceState, not push: switching screens or tabs shouldn't pile
   * up history entries. Any fragment goes, except `#gsea`, the enrichment module's sub-state.
   */
  const navigate = useCallback(
    (view: ComparisonView, panel: ComparisonPanel | null, { scroll }: { scroll: boolean }) => {
      if (typeof window === 'undefined') return;
      const url = new URL(window.location.href);
      url.searchParams.delete('tab');
      if (view === 'explorer') url.searchParams.delete('view');
      else url.searchParams.set('view', view);
      if (panel) url.searchParams.set(PANEL_PARAM, panel);
      else url.searchParams.delete(PANEL_PARAM);
      url.hash = panel ? modeHash(url.hash) : '';
      window.history.replaceState(null, '', url.toString());
      if (scroll) requestScroll(MODULE_TABS_ID);
    },
    [requestScroll]
  );

  /** From the hub, or from a module pointing at another one. */
  const selectView = useCallback(
    (view: ComparisonView, panel?: ComparisonPanel) =>
      navigate(view, panel ?? null, { scroll: !!panel }),
    [navigate]
  );

  // Cosmetic only: the right screen and tab already render, thanks to the derivations above.
  // This rewrites an old link to the current contract — `?tab=` and `?view=outils` become
  // `?view=`, an `#anchor` from the scrolling layout becomes `?panel=` — so the address bar stops
  // advertising what no longer exists, and toggling ORA/GSEA (which rewrites the fragment) cannot
  // lose the open tab.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = new URLSearchParams(window.location.search);
    const upgraded = upgradeLegacyQuery(current);
    const next = new URLSearchParams(upgraded ?? current.toString());
    const { hash: currentHash } = window.location;
    const fromHash = resolveRequestedPanel(null, currentHash);
    if (fromHash && !next.has(PANEL_PARAM)) next.set(PANEL_PARAM, fromHash);
    const nextHash = fromHash ? modeHash(currentHash) : currentHash;
    if (upgraded === null && next.toString() === current.toString() && nextHash === currentHash) {
      return;
    }
    const query = next.toString();
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${nextHash}`
    );
  }, [searchParams, hash]);


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

  // Genes that entered the test — the denominator of "of N genes tested". A row count, blind to
  // thresholds, and the one figure the volcano cloud cannot supply: the cloud is capped at
  // VOLCANO_MAX_POINTS, so its length is a floor rather than the tested count.
  //
  // The up/down/total counts are NOT read from here. They come from useSignificanceSummary below,
  // which is the page's single DEG definition.
  const [genesTested, setGenesTested] = useState<number | undefined>(undefined);

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



  // Fetch the denominator only.
  //
  // This effect used to compute and display the DEG counts, and to `api.patch` them back onto
  // `dataset_metadata` — a write-on-read that froze client-computed numbers into the dataset and
  // is precisely how the page ended up with two contradictory counts. Both write-backs and the
  // 100k-row legacy fallback are gone; the counts now come from useSignificanceSummary.
  useEffect(() => {
    if (!degDataset) return;

    const metadata = degDataset.dataset_metadata as Record<string, unknown> | undefined;
    const toNumber = (value: unknown): number | undefined => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };
    const comparisons =
      metadata?.comparisons && typeof metadata.comparisons === 'object' && !Array.isArray(metadata.comparisons)
        ? (metadata.comparisons as Record<string, Record<string, unknown>>)
        : undefined;

    // Already known from a previous ingestion or visit.
    const fromMetadata = globalDatasetId
      ? toNumber(comparisons?.[decodedName]?.deg_tested)
      : toNumber(metadata?.deg_tested);
    if (fromMetadata !== undefined) {
      setGenesTested(fromMetadata);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await api.get(`/datasets/${degDataset.id}/stats`, {
          params: globalDatasetId ? { comparison_name: decodedName } : {},
        });
        if (cancelled) return;
        setGenesTested(toNumber(response.data?.total_genes));
      } catch (err) {
        // A missing denominator only drops the "of N genes tested" clause; the counts stand.
        console.error('Failed to fetch genes-tested count:', err);
        if (!cancelled) setGenesTested(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [degDataset, decodedName, globalDatasetId]);

  // The page's single DEG count, recomputed at the live thresholds. Every consumer below — the
  // response synthesis, the header chips, the module subtitles — reads this, so they cannot drift
  // apart the way the header and the overview had. The overview strip calls the same hook and
  // shares its React Query entry, so this costs no extra request.
  const { summary: significance, isLoading: significanceLoading } = useSignificanceSummary(
    degDataset?.id ?? '',
    actualComparisonName,
    !!degDataset
  );

  // Same thresholds the counts were derived at, so the caption below states the rule that
  // actually produced them rather than a hardcoded guess.
  const thresholds = useThresholds();

  /** Shape the existing consumers already take, now fed from one source. */
  const stats = useMemo(
    () =>
      significance
        ? {
            degUp: significance.up,
            degDown: significance.down,
            degTotal: significance.significant,
            genesTested,
          }
        : null,
    [significance, genesTested]
  );
  const statsLoading = significanceLoading;

  /** Per-method p-values as CSV — offered beside the DEG table and again under Share. */
  const downloadDegStats = async () => {
    if (!degDataset) return;
    try {
      const response = await api.get(`/datasets/${degDataset.id}/deg-stats/export`, {
        params: { comparison: actualComparisonName },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `deg_stats_${actualComparisonName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('DEG stats download failed', e);
    }
  };

  // What this comparison offers, and why a module is out of reach.
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

  /** The four screens with their modules, for the hub's cards and their counts. */
  const viewGroups = useMemo(() => groupModulesByView(comparisonModules), [comparisonModules]);

  /** The open screen's group, which the module accordion below details. */
  const activeGroup = useMemo(
    () => viewGroups.find((group) => group.view === activeView),
    [viewGroups, activeView]
  );

  /**
   * The open screen's tabs: its modules that can be opened now, in catalogue order. A module
   * waiting on data or locked behind an add-on is not a tab — the disclosure above says why, and
   * offers to request access.
   */
  const viewTabs = useMemo(
    () =>
      comparisonModules
        .filter((m) => m.view === activeView && m.state === 'ready')
        .map((m) => ({ panel: m.panel, label: m.title, icon: m.icon })),
    [comparisonModules, activeView]
  );

  /**
   * The open tab: the one asked for when this screen has it, else the screen's first.
   *
   * Derived, never written back: while the profile loads every add-on reads as locked, and a
   * fallback stored in the URL would outlive that moment and lose the module the link named.
   */
  const activePanel: ComparisonPanel | null =
    viewTabs.find((tab) => tab.panel === requestedPanel)?.panel ?? viewTabs[0]?.panel ?? null;


  if (loading) {
    return (
      <div className="p-8 text-center text-body-sm text-muted">
        Loading…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-8 text-center text-body-sm text-muted">
        Failed to load comparison details.
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-8 text-center text-body-sm text-muted">
        Project not found
      </div>
    );
  }

  if (!degDataset) {
    return (
      <div className="py-8">
        <div className="page-container">
          <Link href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`} className="inline-flex items-center text-body-sm text-secondary hover:text-primary mb-4">
            <ArrowLeft className="mr-1 h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
          </Link>
          <div className="bg-warning-soft p-4 rounded-sm mt-4">
            <p className="text-warning-ink">No Differential Expression (DEG) dataset found for this comparison.</p>
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
        <p className="mt-2 text-body-sm text-danger">
          {reprocessError}
        </p>
      ) : null}

      {/* Une seule bande d'orientation, plus quatre.
          L'ecran empilait l'en-tete, la synthese, quatre grandes cartes d'ecran
          et le repli des modules avant le moindre contenu — environ 500 a 600px
          de chrome au-dessus du nuage de volcan. La synthese et le commutateur
          d'ecran se serrent desormais sous l'identite de la comparaison.

          La synthese reste au-dessus des quatre ecrans parce qu'elle est vraie
          de chacun d'eux ; c'est aussi ce qui a dissous l'ancienne vue
          « overview ». */}
      <div className="mt-3 space-y-3">
        <ComparisonSynthesis
          comparisonName={decodedName}
          stats={stats}
          sampleConditionMap={sampleConditionMap}
          loading={statsLoading}
          padjThreshold={thresholds.padj}
          log2fcThreshold={thresholds.logfc}
        />

        <ComparisonViewHub
          groups={viewGroups}
          activeView={activeView}
          onSelect={(view) => selectView(view)}
        />
      </div>

      <ComparisonModuleDisclosure
        // Re-keyed per screen, so a screen with nothing to open arrives with its list unfolded
        // instead of inheriting the previous screen's folded state.
        key={activeView}
        group={activeGroup}
        defaultOpen={viewTabs.length === 0}
        onOpen={(view, panel) => selectView(view, panel)}
      />

      {/* Un module a la fois, en onglets.

          L'ecran empilait tous ses modules sur un seul defilement, sous un rail
          d'ancres colle en haut. Ce rail etait le « header des modules qui
          descend » : colle 64px sous le haut d'un conteneur qui commence deja
          sous la barre du haut, il laissait defiler le contenu au-dessus de
          lui ; et chaque section montee en retard poussait la cible du saut plus
          bas. Un seul onglet ouvert : plus rien ne change de hauteur au-dessus
          du module lu, et rien n'a besoin de coller.

          Les sections gardent leur `<section id>` : c'est le panneau de leur
          onglet, et l'ancre que les anciens favoris visent encore. */}
      <div className="mt-6">
        {viewTabs.length > 0 ? (
          <ModuleTabs
            label={`${VIEW_LABELS[activeView]} modules`}
            tabs={viewTabs}
            value={activePanel}
            onValueChange={(panel) => navigate(activeView, panel, { scroll: false })}
          />
        ) : (
          <p className="text-body-sm text-secondary">
            Nothing on this screen is open for this comparison yet. The list above says what each
            module needs, and lets you request the add-ons.
          </p>
        )}

        {activeView === 'comprendre' && (
          <div className="mt-4 empty:hidden">
            <PathwayFocusBar
              onShowInExplorer={(genes, label) => {
                // Explicit and user-initiated. The only crossing between screens in the
                // whole cross-filter; everything else happens in place.
                selectGenes(genes, 'pathway', label);
                focusTerm(null);
                selectView('explorer', 'genes');
              }}
            />
          </div>
        )}

        <div className="mt-6">
          {/* ── Explore ───────────────────────────────────────────────── */}
          {activePanel === 'summary' && (
            <section id="summary" {...tabPanel('summary')}>
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

          {activePanel === 'genes' && (
            <section id="genes" {...tabPanel('genes')} className="space-y-6">
              {/* One significance control for the whole pane, with the counts it produces. */}
              <SynthesisStrip
                datasetId={degDataset.id}
                comparisonName={actualComparisonName}
              />

              {/* Volcano plot — the whole comparison at a glance, next to the
                  table it filters down to. */}
              <div className="gl-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-display text-body font-semibold text-primary">
                    Volcano plot
                  </h2>
                  <Link
                    href={`/projects/${projectId}/datasets/${degDataset.id}`}
                    className="text-caption font-semibold text-accent-ink"
                  >
                    View dataset
                  </Link>
                </div>

                {/* Resolves a ?geneList= link into the shared selection. Renders nothing. */}
                <GeneListDeepLink projectId={projectId} />

                {/* `items-start` : sans lui la carte de selection, element de grille
                    etire a la hauteur de la ligne, ne pouvait jamais coller. */}
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-heading text-primary">Differentially Expressed Genes</h2>
                  <button
                    type="button"
                    className={buttonClasses({ variant: 'outline', size: 'sm' })}
                    onClick={downloadDegStats}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Per-method p-values (.csv)
                  </button>
                </div>
                <p className="mb-4 text-body-sm text-secondary">
                  Browse all differentially expressed genes with filtering and sorting capabilities.
                </p>
                {/* Plus de `overflow-hidden` ici : il rognait le menu « Columns » et
                    l'export du tableau, deux popovers en position absolue, des que la
                    liste etait courte (vide, en chargement ou tres filtree). Le
                    tableau defile deja dans son propre conteneur. */}
                <div className="rounded-control bg-surface">
                  <DEGTable dataset={degDataset} comparisonName={actualComparisonName} />
                </div>
              </div>
            </section>
          )}

          {activePanel === 'methods' && (
            <section id="methods" {...tabPanel('methods')}>
              <MethodStatsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
            </section>
          )}

          {activePanel === 'heatmap' && (
            <section id="heatmap" {...tabPanel('heatmap')}>
              {matrixDataset ? (
                <HeatmapSection
                  degDataset={degDataset}
                  matrixDataset={matrixDataset}
                  comparisonName={actualComparisonName}
                  sampleIds={relevantSamples.length > 0 ? relevantSamples : undefined}
                  sampleConditionMap={
                    Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined
                  }
                />
              ) : (
                <NoMatrix purpose="Clustering" />
              )}
            </section>
          )}

          {activePanel === 'external-lookup' && (
            <section id="external-lookup" {...tabPanel('external-lookup')}>
              <StringEnrichmentPanel />
            </section>
          )}

          {activePanel === 'custom-viz' && (
            <section id="custom-viz" {...tabPanel('custom-viz')}>
              <CustomVisualizationPanel
                datasetId={degDataset.id}
                comparisonName={actualComparisonName}
                allGenes={allMatrixGenes}
              />
            </section>
          )}

          {/* ── Understand ────────────────────────────────────────────── */}
          {activePanel === 'ai' && (
            <section id="ai" {...tabPanel('ai')}>
              {/* The AI reading opens the screen: the synthesis above gives the numbers,
                  this says what they mean, and the other tabs are the evidence. */}
              <AIInterpretationPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
            </section>
          )}

          {activePanel === 'enrichment' && (
            <section id="enrichment" {...tabPanel('enrichment')} className="space-y-4">
              {/* Bascule ORA / GSEA rankee.

                  L'ancre #gsea vivait sur le conteneur de la bascule ; la
                  primitive ne prend pas d'id, elle passe donc sur un point
                  d'ancrage dedie, pour que le fragment garde ou atterrir. */}
              <span id={GSEA_HASH} className="block" aria-hidden />
              <SegmentedControl
                label="Enrichment method"
                items={[
                  { value: 'ora' as const, label: 'Over-representation (ORA)' },
                  {
                    value: 'gsea' as const,
                    label: 'GSEA (ranked)',
                    locked: !scientificUnlocked,
                    lockedHint:
                      'GSEA is part of the Scientific tools add-on — request access from the comparison overview',
                  },
                ]}
                value={enrichmentMode}
                onValueChange={setEnrichmentMode}
              />

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
            </section>
          )}

          {activePanel === 'network' && (
            <section id="network" {...tabPanel('network')}>
              <PPINetworkSection
                dataset={degDataset}
                comparisonName={actualComparisonName}
                geneNameMap={geneMap.nameByGene}
                projectSpecies={project.species}
              />
            </section>
          )}

          {/* ── Apply ─────────────────────────────────────────────────── */}
          {activePanel === 'drug-discovery' && (
            <section id="drug-discovery" {...tabPanel('drug-discovery')}>
              {/* `actualComparisonName` et non `decodedName` : c'est la clé stockée, et celle
                  que porte `deg_genes.comparison_name` côté base. */}
              <DrugDiscoveryComparisonPanel
                datasetId={degDataset.id}
                comparisonName={actualComparisonName}
              />
            </section>
          )}

          {activePanel === 'signature' && (
            <section id="signature" {...tabPanel('signature')}>
              {matrixDataset ? (
                <SignatureScorePanel
                  projectId={projectId}
                  matrixDatasetId={matrixDataset.id}
                  samples={relevantSamples.length > 0 ? relevantSamples : undefined}
                  sampleConditionMap={
                    Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined
                  }
                  initialGenes={focusedTerm?.genes}
                  initialLabel={focusedTerm?.name}
                />
              ) : (
                <NoMatrix purpose="Signature scoring" />
              )}
            </section>
          )}

          {activePanel === 'cosmomics' && (
            <section id="cosmomics" {...tabPanel('cosmomics')}>
              {/* Skin claims became CosmOmics: bookmarks to `#cosmetics` land here. */}
              <span id="cosmetics" aria-hidden className="block" />
              <CosmOmicsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
            </section>
          )}

          {/* ── Share ─────────────────────────────────────────────────── */}
          {activePanel === 'exports' && (
            <section id="exports" {...tabPanel('exports')} className="space-y-3">
              <div>
                <h3 className="text-body-sm font-semibold text-primary">
                  Exports
                </h3>
                <p className="text-caption text-muted">
                  Every differentially expressed gene of this comparison at the current thresholds
                  (padj ≤ {thresholds.padj}, |log2FC| ≥ {thresholds.logfc}), and its per-method
                  p-values.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ExportMenu
                  fetchData={async () =>
                    (await fetchAllDegGenes(degDataset.id, actualComparisonName, thresholds)).map(
                      toDegExportRow
                    )
                  }
                  filename={`${actualComparisonName}_all_DEGs`}
                  formats={['csv', 'json']}
                  csvColumns={DEG_EXPORT_COLUMNS}
                  variant="outline"
                  size="sm"
                />
                <button
                  type="button"
                  className={buttonClasses({ variant: 'outline', size: 'sm' })}
                  onClick={downloadDegStats}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Per-method p-values (.csv)
                </button>
              </div>
            </section>
          )}

          {activePanel === 'report' && (
            <section id="report" {...tabPanel('report')}>
              <ReportCustomizationPanel />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** A module that needs the expression matrix, on a project without one. */
function NoMatrix({ purpose }: { purpose: string }) {
  return (
    <div className="py-16 text-center">
      <Database className="mx-auto mb-4 h-12 w-12 text-muted" aria-hidden />
      <h3 className="mb-2 text-title font-medium text-primary">No expression matrix</h3>
      <p className="mx-auto max-w-sm text-body-sm text-secondary">
        {purpose} requires an expression matrix (count matrix). Upload a dataset of type
        &quot;Expression Matrix&quot; to enable it.
      </p>
    </div>
  );
}
