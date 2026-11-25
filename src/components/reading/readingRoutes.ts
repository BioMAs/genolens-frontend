/**
 * The reading's vocabulary and URL contract.
 *
 * A comparison used to be four screens of fourteen module tabs; it is now one page that reads
 * top to bottom, split into **parts**, with the heavy tools (methods, GSEA, the full table…) in
 * a **focus** view opened from the part's figure. This file names both and maps every URL the old
 * page ever produced onto them, so a saved link still lands somewhere true.
 *
 * Kept React-free, like `comparisonRoutes.ts`, so the whole mapping is unit-testable — a URL
 * contract is exactly the kind of logic that rots silently inside a component.
 *
 * **Two forms are read, one is written.**
 *
 * - The canonical form, written by `readingLocation`: `#part-<id>` for the part in view,
 *   `?focus=<kind>` for an open focus view, `?report=1` for the report.
 * - The old form (`?view=`, `?panel=`, `?tab=`, the `#gsea` and scrolling-layout fragments),
 *   read only, through `resolveRequestedPanel` and `resolveView` — their rules are not copied here.
 *
 * The canonical form wins whenever any of it is present. Nothing about the old form is ever
 * written back out.
 */

import {
  resolveRequestedPanel,
  resolveView,
  type ComparisonPanel,
  type ComparisonView,
} from '@/components/comparison/comparisonRoutes';
import { GSEA_HASH } from '@/components/comparison/useEnrichmentMode';

/** A part of the reading, top to bottom. The last three sit under `applications`. */
export type ReadingPart =
  | 'answers'
  | 'counts'
  | 'genes'
  | 'processes'
  | 'meaning'
  | 'applications'
  | 'targets'
  | 'skin'
  | 'signature';

export interface ReadingPartInfo {
  id: ReadingPart;
  /** The label the page and the floating menu show. */
  label: string;
  /** The question's number in the answers strip; only the five questions carry one. */
  number?: 1 | 2 | 3 | 4 | 5;
  /** Set on the three applications, which are sub-parts of the fifth question. */
  parent?: 'applications';
}

/** In reading order: the answers strip, the five questions, then the three applications. */
export const READING_PARTS: ReadonlyArray<ReadingPartInfo> = [
  { id: 'answers', label: 'Answers' },
  { id: 'counts', label: 'Gene counts', number: 1 },
  { id: 'genes', label: 'Top genes', number: 2 },
  { id: 'processes', label: 'Processes', number: 3 },
  { id: 'meaning', label: 'Meaning', number: 4 },
  { id: 'applications', label: 'Applications', number: 5 },
  { id: 'targets', label: 'Drug targets', parent: 'applications' },
  { id: 'skin', label: 'Skin claims', parent: 'applications' },
  { id: 'signature', label: 'Signature score', parent: 'applications' },
];

/** The part a URL opens when it names none. It is also the one that is never written as a fragment. */
const DEFAULT_PART: ReadingPart = 'answers';

/** The id a part's section carries in the page, and so the fragment that scrolls to it. */
export function partDomId(part: ReadingPart): string {
  return 'part-' + part;
}

/** The focus views, each a full-screen view opened from a part's figure. */
export const FOCUS_KINDS = [
  'volcano',
  'table',
  'heatmap',
  'methods',
  'lookup',
  'charts',
  'processes',
  'gsea',
  'network',
  'targets',
  'claims',
  'signature',
] as const;

export type FocusKind = (typeof FOCUS_KINDS)[number];

/** What a reading URL selects: the part in view, the open focus view, and whether the report is open. */
export interface ReadingTarget {
  part: ReadingPart;
  focus: FocusKind | null;
  report: boolean;
}

export const FOCUS_PARAM = 'focus';
export const REPORT_PARAM = 'report';

/** The explorer state a part change must not lose: thresholds, the open gene, the gene list, the dataset. */
const KEPT_PARAMS: readonly string[] = ['padj', 'lfc', 'gene', 'geneList', 'datasetId'];

function toFocus(value: string | null): FocusKind | null {
  return (FOCUS_KINDS as readonly string[]).includes(value ?? '') ? (value as FocusKind) : null;
}

function fragment(hash: string): string {
  return hash.replace(/^#/, '');
}

/** The part a `#part-<id>` fragment names, or null for any other fragment — old ones included. */
function partFromHash(hash: string): ReadingPart | null {
  const id = fragment(hash);
  return READING_PARTS.find((p) => partDomId(p.id) === id)?.id ?? null;
}

const target = (part: ReadingPart, focus: FocusKind | null = null, report = false): ReadingTarget => ({
  part,
  focus,
  report,
});

/**
 * Where each old panel lands.
 *
 * A `Record` over `ComparisonPanel`, so a panel added upstream without a destination here is a
 * compile error rather than a dead link. The aliases (`cosmetics`, `gsea`) are resolved by
 * `resolveRequestedPanel` before they get here; `cosmetics` is listed anyway because it is still a
 * member of the union.
 */
const PANEL_TARGETS: Record<ComparisonPanel, ReadingTarget> = {
  summary: target('answers'),
  genes: target('counts'),
  heatmap: target('counts', 'heatmap'),
  methods: target('counts', 'methods'),
  'external-lookup': target('counts', 'lookup'),
  'custom-viz': target('counts', 'charts'),
  ai: target('meaning'),
  enrichment: target('processes'),
  network: target('genes', 'network'),
  'drug-discovery': target('targets'),
  cosmomics: target('skin'),
  cosmetics: target('skin'),
  signature: target('signature'),
  exports: target('genes', 'table'),
  report: target('answers', null, true),
};

/**
 * Where an old screen lands when its URL names no panel.
 *
 * `appliquer` opens on the first application; `partager` has no part of its own any more, only
 * the report. `outils` never reaches here: `resolveView` already folds it into `appliquer`.
 */
const VIEW_TARGETS: Record<ComparisonView, ReadingTarget> = {
  explorer: target('answers'),
  comprendre: target('meaning'),
  appliquer: target('targets'),
  partager: target('answers', null, true),
};

function resolveLegacyTarget(params: URLSearchParams, hash: string): ReadingTarget {
  const panel = resolveRequestedPanel(params, hash);
  if (!panel) return { ...VIEW_TARGETS[resolveView(params)] };

  const resolved = { ...PANEL_TARGETS[panel] };
  // `#gsea` is the ranked half of the enrichment; on any other panel it opens nothing.
  if (panel === 'enrichment' && fragment(hash) === GSEA_HASH) resolved.focus = 'gsea';
  return resolved;
}

/**
 * What a URL asks the reading to show.
 *
 * The canonical form is read first. A valid `?focus=`, a `?report=1` or a valid `#part-<id>` is
 * enough to take it as that form, and the old parameters are then ignored entirely; a part
 * missing from it is the answers, since those are the one part written without a fragment. An
 * unknown `?focus=` or `#part-<id>` counts as absent, so a hand-edited link falls back to the old
 * reading rather than to a pane that does not exist.
 *
 * Callers must **derive** the target with this during render rather than redirect in an effect, so
 * a cold link paints the right part on its first frame.
 */
export function resolveReadingTarget(params: URLSearchParams, hash: string): ReadingTarget {
  const focus = toFocus(params.get(FOCUS_PARAM));
  const report = params.get(REPORT_PARAM) === '1';
  const part = partFromHash(hash);

  if (focus || report || part) return { part: part ?? DEFAULT_PART, focus, report };
  return resolveLegacyTarget(params, hash);
}

/**
 * The canonical URL of a target, as a `search` and a `hash` ready for `history.replaceState`.
 *
 * No `view`, `panel` or `tab`: the old form is never written. Only the explorer state the reader
 * set (`KEPT_PARAMS`) is carried over from `current`, in its original order, so moving between
 * parts keeps the thresholds and the open gene; anything else in the URL is dropped. `search` is
 * `''`, not `'?'`, when nothing remains, and the answers carry no fragment.
 */
export function readingLocation(
  nextTarget: ReadingTarget,
  current: URLSearchParams
): { search: string; hash: string } {
  const next = new URLSearchParams();
  current.forEach((value, key) => {
    if (KEPT_PARAMS.includes(key)) next.append(key, value);
  });
  if (nextTarget.focus) next.set(FOCUS_PARAM, nextTarget.focus);
  if (nextTarget.report) next.set(REPORT_PARAM, '1');

  const query = next.toString();
  return {
    search: query ? `?${query}` : '',
    hash: nextTarget.part === DEFAULT_PART ? '' : `#${partDomId(nextTarget.part)}`,
  };
}

/** The path of a comparison's reading. The name is a free-form label, so it is encoded. */
export function readingHref(projectId: string, comparisonName: string): string {
  return `/projects/${projectId}/comparisons/${encodeURIComponent(comparisonName)}`;
}
