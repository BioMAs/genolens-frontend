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
  Boxes,
  FileText,
  FlaskConical,
  Network,
  Pill,
  Sigma,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleId } from '@/components/modules/ModuleSelector';

/** Tabs a module card can open — a subset of ComparisonDetail's TabType. */
export type ComparisonModuleTab =
  | 'deg'
  | 'metrics'
  | 'enrichment'
  | 'clustering'
  | 'integrations'
  | 'signature'
  | 'drug-discovery'
  | 'cosmetics'
  | 'report';

/**
 * `ready`      — open it now.
 * `needs-data` — the module exists but this project lacks the input it needs.
 * `locked`     — add-on module the user has no access to yet.
 */
export type ComparisonModuleState = 'ready' | 'needs-data' | 'locked';

export interface ComparisonModule {
  id: string;
  /** Target tab, or null when the module is locked (its tab is not rendered). */
  tab: ComparisonModuleTab | null;
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
  stats,
}: ComparisonModulesInput): ComparisonModule[] {
  const modules: ComparisonModule[] = [
    {
      id: 'deg',
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
      id: 'metrics',
      tab: 'metrics',
      title: 'Method statistics',
      description: 'Per-method p-values and the Stouffer consensus',
      icon: Sigma,
      state: 'ready',
      metric: 'DESeq2 · edgeR · limma',
    },
    {
      id: 'enrichment',
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
      tab: 'drug-discovery',
      title: 'Drug targets',
      description: 'Druggable targets ranked from these DEGs',
      icon: Pill,
      state: 'ready',
      metric: 'Ranked from this comparison',
    },
    {
      id: 'integrations',
      tab: 'integrations',
      title: 'Integrations',
      description: 'Look these genes up in public databases',
      icon: Boxes,
      state: 'ready',
      metric: 'External resources',
    },
    {
      id: 'clustering',
      tab: 'clustering',
      title: 'Heatmap & clustering',
      description: 'DEG expression across the samples of this comparison',
      icon: Activity,
      state: hasMatrix ? 'ready' : 'needs-data',
      ...(hasMatrix ? { metric: 'Sample-level heatmap' } : { hint: NEEDS_MATRIX }),
    },
    {
      id: 'signature',
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
      tab: cosmeticsUnlocked ? 'cosmetics' : null,
      title: 'Skin claims',
      description: 'Turn this comparison into scored cosmetic claims',
      icon: Sparkles,
      state: cosmeticsUnlocked ? 'ready' : 'locked',
      addOnId: 'claim',
      ...(cosmeticsUnlocked ? { metric: 'Claim scores · Skin Stack' } : { hint: ADD_ON }),
    },
    {
      id: 'reporting',
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
