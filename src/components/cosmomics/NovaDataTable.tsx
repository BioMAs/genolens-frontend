import type { CosmOmicsNovaData, NovaSubgroup } from '@/types/cosmomics';
import { formatP } from './novaLayout';

function Row({ claim, sub }: { claim: string; sub: NovaSubgroup }) {
  const linked = claim !== 'Not linked';
  return (
    <tr className="border-t border-[#E6EEF2] align-top">
      <td className="py-1.5 pr-3 font-medium">{claim}</td>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
        {sub.name}
      </th>
      <td className="whitespace-nowrap py-1.5 pr-3">{formatP(sub.nl)}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{linked ? sub.s_pro.toFixed(1) : '—'}</td>
      <td className="py-1.5 pr-3 text-right tabular-nums">{linked ? sub.s_anti.toFixed(1) : '—'}</td>
      <td className="py-1.5 pr-3">{linked ? (sub.delta > 0 ? 'for' : 'against') : '—'}</td>
      <td className="py-1.5 pr-3">{sub.obs === 'up' ? '↑ up' : '↓ down'}</td>
      <td className="py-1.5">
        {sub.terms
          .map(
            (t) =>
              `${t.id} ${t.label} (${formatP(t.nl)}, ${t.obs}${t.effect ? `, ${t.effect > 0 ? 'pro' : 'anti'}` : ''})`,
          )
          .join('; ')}
      </td>
    </tr>
  );
}

/** Every number behind the picture, reachable without a mouse. */
export default function NovaDataTable({ data }: { data: CosmOmicsNovaData }) {
  return (
    <details className="group rounded-lg border border-[#E6EEF2] bg-white px-4 py-3 text-[#3A4150]">
      <summary className="cursor-pointer text-[13px] font-semibold text-[#0B2A3E]">
        Data table — sub-groups behind each claim
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <caption className="sr-only">
            CosmOmics pathway nova for {data.contrast}: one row per sub-group, p combined over its terms
            (Stouffer).
          </caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-[#7D8B9C]">
              <th scope="col" className="pb-1 pr-3">Claim</th>
              <th scope="col" className="pb-1 pr-3">Sub-group</th>
              <th scope="col" className="pb-1 pr-3">p</th>
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
