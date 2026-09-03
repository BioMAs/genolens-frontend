/**
 * Module catalogue of the comparison results page.
 *
 * Single source of truth for what a comparison can offer and why a module is
 * out of reach. Before this file the answer was scattered across the tab bar of
 * ComparisonDetail: a locked add-on removed its own tab (so the capability was
 * invisible), and a module waiting on data was flagged with a three-character
 * "(N/A)" that never said what was missing.
 *
 * Kept free of React so the state derivation is unit-testable on its own.
 */

import {
  Activity,
  Download,
  Boxes,
  FileText,
  FlaskConical,
  LineChart,
  Network,
  Pill,
  Sigma,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId } from '@/components/modules/ModuleSelector';
import {
  VIEW_DESCRIPTIONS,
  VIEW_LABELS,
  VIEW_ORDER,
  type ComparisonPanel,
  type ComparisonView,
} from './comparisonRoutes';

/**
 * Legacy `?tab=` key a module used to answer to.
 *
 * No longer the navigation target — `view` plus `panel` is — and no longer a gate on whether a
 * module can be opened, which is `state === 'ready'`. Kept so an old link still resolves, and
 * null for a module that never had a tab of its own.
 */
export type ComparisonModuleTab =
  | 'deg'
  | 'metrics'
  | 'enrichment'
  | 'clustering'
  | 'integrations'
  | 'signature'
  | 'drug-discovery'
  | 'cosmetics'
  | 'report'
  | 'custom-viz';

/**
 * `ready`      — open it now.
 * `needs-data` — the module exists but this project lacks the input it needs.
 * `locked`     — add-on module the user has no access to yet.
 */
export type ComparisonModuleState = 'ready' | 'needs-data' | 'locked';

export interface ComparisonModule {
  id: string;
  /** Legacy `?tab=` key, or null for a module that never had one. See the type's note. */
  tab: ComparisonModuleTab | null;
  /** Which of the three merged screens this module belongs to. */
  view: ComparisonView;
  /** The anchor within that screen. */
  panel: ComparisonPanel;
  title: string;
  description: string;
  icon: LucideIcon;
  state: ComparisonModuleState;
  /** Shown when ready — what the module holds for this comparison. */
  metric?: string;
  /** Shown when not ready — why, in the user's terms. */
  hint?: string;
  /** Add-on identifier, used to request access. */
  addOnId?: ModuleId;
}

export interface ComparisonModulesInput {
  /** An expression matrix is available in the project. */
  hasMatrix: boolean;
  /** A pre-computed enrichment dataset is attached to this comparison. */
  hasEnrichmentFile: boolean;
  cosmeticsUnlocked: boolean;
  reportUnlocked: boolean;
  /** Scientific tools add-on (GSEA, signature scoring, …) unlocked for this user. */
  scienceUnlocked: boolean;
  /** Drug Discovery add-on unlocked for this user. */
  drugDiscoveryUnlocked: boolean;
  stats: { degUp: number; degDown: number; degTotal: number } | null;
}

const NEEDS_MATRIX = 'Needs an expression matrix';
const ADD_ON = 'Add-on module';

const STATE_ORDER: Record<ComparisonModuleState, number> = {
  ready: 0,
  'needs-data': 1,
  locked: 2,
};

/**
 * Build the module list for one comparison, ordered ready → needs-data → locked
 * so the first thing the eye lands on is what can be opened right now.
 */
export function buildComparisonModules({
  hasMatrix,
  hasEnrichmentFile,
  cosmeticsUnlocked,
  reportUnlocked,
  scienceUnlocked,
  drugDiscoveryUnlocked,
  stats,
}: ComparisonModulesInput): ComparisonModule[] {
  const modules: ComparisonModule[] = [
    {
      id: 'deg',
      view: 'explorer',
      panel: 'genes',
      tab: 'deg',
      title: 'DEG table',
      description: 'Every gene of this comparison, with filters and sorting',
      icon: Table2,
      state: 'ready',
      metric: stats
        ? `${stats.degTotal.toLocaleString('en-US')} significant gene${stats.degTotal === 1 ? '' : 's'}`
        : 'Browse all genes',
    },
    {
      id: 'ai',
      view: 'comprendre',
      panel: 'ai',
      // It never had a tab: it lived on the overview, which the three-screen model dissolves.
      tab: null,
      title: 'AI reading',
      description: 'What this comparison means, in plain language',
      icon: Sparkles,
      state: 'ready',
      metric: 'Plain-language interpretation',
    },
    {
      id: 'metrics',
      view: 'explorer',
      panel: 'methods',
      tab: 'metrics',
      title: 'Method statistics',
      description: 'Per-method p-values and the Stouffer consensus',
      icon: Sigma,
      state: 'ready',
      metric: 'DESeq2 · edgeR · limma',
    },
    {
      id: 'enrichment',
      view: 'comprendre',
      panel: 'enrichment',
      tab: 'enrichment',
      title: 'Enrichment',
      description: 'Pathways behind the differential expression',
      icon: Network,
      state: 'ready',
      metric: scienceUnlocked
        ? hasEnrichmentFile
          ? 'ORA · GSEA · pathways ready'
          : 'ORA · GSEA'
        : hasEnrichmentFile
          ? 'ORA · pathways ready'
          : 'Over-representation (ORA)',
    },
    {
      id: 'drug-discovery',
      view: 'outils',
      panel: 'drug-discovery',
      tab: drugDiscoveryUnlocked ? 'drug-discovery' : null,
      title: 'Drug targets',
      description: 'Druggable targets ranked from these DEGs',
      icon: Pill,
      state: drugDiscoveryUnlocked ? 'ready' : 'locked',
      addOnId: 'drugdiscovery',
      ...(drugDiscoveryUnlocked
        ? { metric: 'Ranked from this comparison' }
        : { hint: ADD_ON }),
    },
    {
      id: 'network',
      view: 'comprendre',
      panel: 'network',
      tab: 'integrations',
      title: 'Interaction network',
      description: 'How these proteins are known to interact',
      icon: Network,
      state: 'ready',
      metric: 'STRING interactions',
    },
    {
      id: 'clustering',
      view: 'explorer',
      panel: 'heatmap',
      tab: 'clustering',
      title: 'Heatmap & clustering',
      description: 'DEG expression across the samples of this comparison',
      icon: Activity,
      state: hasMatrix ? 'ready' : 'needs-data',
      ...(hasMatrix ? { metric: 'Sample-level heatmap' } : { hint: NEEDS_MATRIX }),
    },
    {
      id: 'signature',
      view: 'comprendre',
      panel: 'signature',
      tab: scienceUnlocked ? 'signature' : null,
      title: 'Signature score',
      description: 'Score a gene signature sample by sample',
      icon: FlaskConical,
      state: !scienceUnlocked ? 'locked' : hasMatrix ? 'ready' : 'needs-data',
      addOnId: 'science',
      ...(!scienceUnlocked
        ? { hint: ADD_ON }
        : hasMatrix
          ? { metric: 'Per-sample scoring' }
          : { hint: NEEDS_MATRIX }),
    },
    {
      id: 'claim',
      view: 'outils',
      panel: 'cosmetics',
      tab: cosmeticsUnlocked ? 'cosmetics' : null,
      title: 'Skin claims',
      description: 'Turn this comparison into scored cosmetic claims',
      icon: Sparkles,
      state: cosmeticsUnlocked ? 'ready' : 'locked',
      addOnId: 'claim',
      ...(cosmeticsUnlocked ? { metric: 'Claim scores · Skin Stack' } : { hint: ADD_ON }),
    },
    {
      id: 'external-lookup',
      view: 'outils',
      panel: 'external-lookup',
      tab: 'integrations',
      title: 'Database lookup',
      description: 'Annotate a gene list against public databases',
      icon: Boxes,
      state: 'ready',
      metric: 'STRING enrichment',
    },
    {
      id: 'exports',
      view: 'partager',
      panel: 'exports',
      tab: null,
      title: 'Exports',
      description: 'Gene tables and figures, as files',
      icon: Download,
      state: 'ready',
      metric: 'CSV · JSON',
    },
    {
      id: 'custom-viz',
      view: 'outils',
      panel: 'custom-viz',
      tab: 'custom-viz',
      title: 'Free-form charts',
      description: 'Build a chart from any genes of this comparison',
      icon: LineChart,
      // A valid ?tab= value that no card and no sidebar entry pointed at: reachable only by
      // hand-typing a URL. It finally has a home.
      state: hasMatrix ? 'ready' : 'needs-data',
      ...(hasMatrix ? { metric: 'Pick genes and axes' } : { hint: NEEDS_MATRIX }),
    },
    {
      id: 'reporting',
      view: 'partager',
      panel: 'report',
      tab: reportUnlocked ? 'report' : null,
      title: 'Reporting',
      description: 'Branded, editable PDF report of this comparison',
      icon: FileText,
      state: reportUnlocked ? 'ready' : 'locked',
      addOnId: 'reporting',
      ...(reportUnlocked ? { metric: 'Custom branding · export' } : { hint: ADD_ON }),
    },
  ];

  // Stable sort: state groups first, declaration order preserved inside a group.
  return modules
    .map((module, index) => ({ module, index }))
    .sort(
      (a, b) =>
        STATE_ORDER[a.module.state] - STATE_ORDER[b.module.state] || a.index - b.index
    )
    .map(({ module }) => module);
}

/** One of the merged screens, with the modules it holds. */
export interface ComparisonViewGroup {
  view: ComparisonView;
  label: string;
  description: string;
  modules: ComparisonModule[];
  counts: Record<ComparisonModuleState, number>;
}

/**
 * Bucket modules into the four screens, in fixed order.
 *
 * Order *within* a group comes free: `buildComparisonModules` already returns modules sorted
 * `ready -> needs-data -> locked`, and bucketing preserves input order, so no second sort is
 * needed and the existing sort tests keep guarding it.
 *
 * Every view appears in the result, even with no modules — a screen that exists but happens to
 * be empty for this comparison is information, and the caller decides how to show it.
 */
export function groupModulesByView(modules: ComparisonModule[]): ComparisonViewGroup[] {
  return VIEW_ORDER.map((view) => {
    const inView = modules.filter((m) => m.view === view);
    return {
      view,
      label: VIEW_LABELS[view],
      description: VIEW_DESCRIPTIONS[view],
      modules: inView,
      counts: countModuleStates(inView),
    };
  });
}

/** Counts per state, for the one-line summary above the grid. */
export function countModuleStates(
  modules: ComparisonModule[]
): Record<ComparisonModuleState, number> {
  return modules.reduce(
    (acc, m) => {
      acc[m.state] += 1;
      return acc;
    },
    { ready: 0, 'needs-data': 0, locked: 0 } as Record<ComparisonModuleState, number>
  );
}
