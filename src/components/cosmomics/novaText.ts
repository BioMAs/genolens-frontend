import type { CosmOmicsNovaData, NovaClaim, NovaClaimState } from '@/types/cosmomics';

/**
 * The sentences the nova writes about itself — what it was computed from, what a
 * claim's state means, how an AI text is labelled. Pure functions of the payload:
 * the page, the export and the tests read the same words.
 */

/** Default significance threshold of the whole module (the backend's own). */
export const DEFAULT_ALPHA = 0.05;

/** A claim's state in words, as the claim card and the legends write it. */
export const CLAIM_STATE_TEXT: Record<NovaClaimState, string> = {
  for_only: 'evidence for only, none against',
  against_only: 'evidence against only, none for',
  both_ways: 'evidence both for and against',
};

/** The same, as a short count label ("3 for only"), for summaries. */
export const CLAIM_STATE_COUNT_TEXT: Record<NovaClaimState, string> = {
  for_only: 'for only',
  both_ways: 'for and against',
  against_only: 'against only',
};

/** Shown for a claim of the referential that has no significant term in this comparison. */
export const NOT_EVALUATED_TEXT = 'n.e. — no significant term (non-significant terms are not stored)';

/** R-P1: a stored term that is not significant is drawn faded, and still counted. */
export const STILL_COUNTED_TEXT = 'Terms not significant at α still contribute with their weight.';

/** First eight characters of a dataset id: enough to find it again, short enough to print. */
export function shortDatasetId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '';
}

/**
 * The state the payload gives, or the one its weights imply (older payloads and
 * the reference fixture carry none): only for it, only against it, or both.
 */
export function claimStateOf(claim: Pick<NovaClaim, 's_pro' | 's_anti'> & { state?: NovaClaimState }): NovaClaimState {
  if (claim.state) return claim.state;
  if (claim.s_anti === 0) return 'for_only';
  if (claim.s_pro === 0) return 'against_only';
  return 'both_ways';
}

/** "YYYY-MM-DD" of a timestamp, in UTC like the backend's clock; null when there is none. */
export function formatDay(timestamp: string | null | undefined): string | null {
  if (!timestamp) return null;
  const moment = new Date(timestamp);
  return Number.isNaN(moment.getTime()) ? null : moment.toISOString().slice(0, 10);
}

/**
 * The label every AI text of GenoLens carries: the model that wrote it and the day
 * it was written. What the response does not say is said not to be recorded.
 */
export function aiLabel(model: string | null | undefined, generatedAt: string | null | undefined): string {
  return `AI-generated text (model ${model || 'not recorded'}, generated ${formatDay(generatedAt) ?? 'date not recorded'})`;
}

/**
 * What the nova was computed from, as lines for the exported figure and the page:
 * the dataset, the threshold, the enrichment cut-off, the referential, the sources,
 * the day; then what the p-values are. Nothing is inferred: a field the payload does
 * not record is said not to be recorded, and a payload without provenance says so.
 */
export function provenanceLines(data: CosmOmicsNovaData): string[] {
  const p = data.provenance;
  if (!p) return ['provenance not recorded'];
  const day = formatDay(p.generated_at);
  const parts = [
    p.dataset_id ? `dataset ${shortDatasetId(p.dataset_id)}` : null,
    `α = ${p.alpha}`,
    p.enrichment_fdr == null ? 'enrichment FDR not recorded' : `enrichment FDR ≤ ${p.enrichment_fdr}`,
    p.referential_version == null ? 'referential version not recorded' : `referential v${p.referential_version}`,
    p.enrichment_databases?.length ? `databases: ${p.enrichment_databases.join(', ')}` : null,
    p.source_versions.length ? `sources: ${p.source_versions.join(', ')}` : null,
    day ? `generated ${day}` : null,
    p.app_version ? `GenoLens ${p.app_version}` : null,
  ];
  return [
    parts.filter((part): part is string => part !== null).join(' · '),
    `p-values — terms: ${data.p_source || 'source not recorded'} · ` +
      'sub-groups: combined p (Stouffer over their terms), not an adjusted p',
  ];
}

/**
 * Break a note into lines of at most `max` characters, for SVG text that does not
 * wrap by itself. Packs the ` · ` separated parts first; a part longer than a line
 * is broken on its spaces; a word longer than a line stays whole.
 */
export function wrapNote(text: string, max = 130): string[] {
  const pack = (items: string[], joiner: string): string[] => {
    const lines: string[] = [];
    for (const item of items) {
      const last = lines[lines.length - 1];
      if (last !== undefined && last.length + joiner.length + item.length <= max) {
        lines[lines.length - 1] = `${last}${joiner}${item}`;
      } else {
        lines.push(item);
      }
    }
    return lines;
  };
  return pack(text.split(' · '), ' · ').flatMap((line) => (line.length > max ? pack(line.split(' '), ' ') : [line]));
}
