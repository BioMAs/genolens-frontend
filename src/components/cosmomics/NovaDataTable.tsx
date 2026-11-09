import type { CosmOmicsNovaData, NovaSubgroup, NovaTerm } from '@/types/cosmomics';
import { formatP, subgroupSide } from './novaLayout';
import { STILL_COUNTED_TEXT } from './novaText';

/** "TERM:1 Label (adj. p = 0.012, up, pro, not significant at α, still counted, both directions)". */
function termText(t: NovaTerm): string {
  const parts = [formatP(t.nl, 'adjusted'), t.obs];
  if (t.effect) parts.push(t.effect > 0 ? 'pro' : 'anti');
  if (t.significant === false) parts.push('not significant at α, still counted');
  if (t.both_directions) parts.push('both directions');
  return `${t.id} ${t.label} (${parts.join(', ')})`;
}

function Row({ claim, sub }: { claim: string; sub: NovaSubgroup }) {
  const linked = claim !== 'Not linked';
  return (
    <tr className="border-t border-[var(--nova-line-soft)] align-top">
      <td className="py-1.5 pr-3 font-medium">{claim}</td>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
        {sub.name}
      </th>
      <td className="whitespace-nowrap py-1.5 pr-3">{formatP(sub.nl)}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{linked ? sub.s_pro.toFixed(1) : '—'}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{linked ? sub.s_anti.toFixed(1) : '—'}</td>
      <td className="py-1.5 pr-3">{linked ? subgroupSide(sub) : '—'}</td>
      <td className="py-1.5 pr-3">{sub.obs === 'up' ? '↑ up' : '↓ down'}</td>
      <td className="py-1.5">{sub.terms.map(termText).join('; ')}</td>
    </tr>
  );
}

/** Every number behind the picture, reachable without a mouse. */
export default function NovaDataTable({ data }: { data: CosmOmicsNovaData }) {
  return (
    <details className="nova-paper group rounded-card border border-[var(--nova-line-soft)] bg-[var(--nova-paper)] px-4 py-3 text-[var(--nova-ink)]">
      <summary className="cursor-pointer text-[13px] font-semibold text-[var(--nova-ink-strong)]">
        Data table — sub-groups behind each claim
      </summary>
      <p className="mt-3 text-[12px] leading-snug text-[var(--nova-ink-muted)]">
        A term&apos;s p is its adjusted p; a sub-group&apos;s p is the Stouffer combination of its terms, not an
        adjusted p. {STILL_COUNTED_TEXT}
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <caption className="sr-only">
            CosmOmics pathway nova for {data.contrast}: one row per sub-group, p combined over its terms
            (Stouffer), and for each term its adjusted p.
          </caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--nova-ink-subtle)]">
              <th scope="col" className="pb-1 pr-3">Claim</th>
              <th scope="col" className="pb-1 pr-3">Sub-group</th>
              <th scope="col" className="pb-1 pr-3">Combined p (Stouffer)</th>
              <th scope="col" className="pb-1 pr-3 text-right">S pro</th>
              <th scope="col" className="pb-1 pr-3 text-right">S anti</th>
              <th scope="col" className="pb-1 pr-3">Evidence</th>
              <th scope="col" className="pb-1 pr-3">Observed</th>
              <th scope="col" className="pb-1">Terms</th>
            </tr>
          </thead>
          <tbody>
            {data.claims.flatMap((claim) =>
              claim.subgroups.map((sub) => <Row key={`${claim.name}|${sub.name}`} claim={claim.name} sub={sub} />),
            )}
            {data.unlinked.map((sub) => (
              <Row key={`unlinked|${sub.name}`} claim="Not linked" sub={sub} />
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
