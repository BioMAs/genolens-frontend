import type { CosmOmicsNovaData, NovaCoverage } from '@/types/cosmomics';
import { provenanceLines } from './novaText';

/** What the stored terms were, and what became of them — each count only when the payload gives it. */
function coverageText(c: NovaCoverage): string {
  return [
    `${c.n_terms} enriched terms read`,
    `${c.n_terms_significant} significant at α`,
    c.n_terms_not_significant != null ? `${c.n_terms_not_significant} not significant at α, still counted` : null,
    c.n_terms_without_padj != null ? `${c.n_terms_without_padj} without an adjusted p, left out` : null,
    `${c.n_terms_matched} matched to the referential`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

/** "How this was computed": the same provenance the exported figure carries, plus the term counts. */
export default function NovaProvenance({ data }: { data: CosmOmicsNovaData }) {
  if (!data.provenance && !data.coverage) return null;
  return (
    <details className="nova-paper rounded-card border border-[var(--nova-line-soft)] bg-[var(--nova-paper)] px-4 py-3 text-[var(--nova-ink)]">
      <summary className="cursor-pointer text-[13px] font-semibold text-[var(--nova-ink-strong)]">
        How this was computed
      </summary>
      <ul className="mt-3 space-y-1 text-[12px] leading-snug text-[var(--nova-ink-muted)]">
        {provenanceLines(data).map((line) => (
          <li key={line}>{line}</li>
        ))}
        {data.coverage && <li>{coverageText(data.coverage)}</li>}
      </ul>
    </details>
  );
}
