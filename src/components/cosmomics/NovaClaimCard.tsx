import type { NovaClaim, NovaSide } from '@/types/cosmomics';
import { formatP, pathwaysFor, subgroupSide } from './novaLayout';
import { NOVA_INK, claimColor } from './novaPalette';
import { CLAIM_STATE_TEXT, claimStateOf } from './novaText';
import { NOVA_FONT } from './CosmOmicsNova';

/** What the card says of a sub-group's side, and in which ink: a contradicting one is greyed, as before. */
const SIDE: Record<NovaSide, { text: string; ink: string }> = {
  for: { text: 'for', ink: NOVA_INK.ink },
  against: { text: 'against', ink: NOVA_INK.againstText },
  balanced: { text: 'balanced', ink: NOVA_INK.ink },
};

/**
 * Claim card of the reference poster (`blocks()`): coherence bar, pathways for / against,
 * and the three most significant sub-groups. The arrow gives the observed direction (up or
 * down) and is never coloured: direction is a fact about the data, not a verdict. Whether a
 * sub-group goes for the claim, against it or is balanced is said in words, next to its
 * combined p.
 *
 * "0 against" is not a confirmation: only significant terms are stored, and the card says
 * what that count can and cannot show.
 */
export default function NovaClaimCard({ claim }: { claim: NovaClaim }) {
  const color = claimColor(claim.name);
  const coherence = Math.round(100 * claim.coherence);
  const good = coherence >= 50;
  const top = [...claim.subgroups].sort((a, b) => b.nl - a.nl).slice(0, 3);

  return (
    <section
      aria-label={`${claim.name} claim card`}
      className="relative pl-4"
      style={{ fontFamily: NOVA_FONT }}
      data-claim-card={claim.name}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[5px] rounded-sm" style={{ background: color.fill }} />
      <h3 className="text-[22px] font-semibold leading-tight" style={{ color: color.text }}>
        {claim.name}
      </h3>
      <div className="mt-2 flex items-center gap-3">
        <div
          className="h-[5px] w-[120px] overflow-hidden rounded-pill bg-[var(--nova-line-soft)]"
          role="meter"
          aria-label="Coherence"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coherence}
          title="Coherence = S pro / (S pro + S anti): the share of the evidence weight that goes for the claim"
        >
          <div
            className="h-full rounded-pill"
            style={{ width: `${coherence}%`, background: good ? NOVA_INK.green : NOVA_INK.against }}
          />
        </div>
        <span className="text-[13px] text-[var(--nova-ink-muted)]">coherence {coherence}%</span>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: good ? NOVA_INK.ink : NOVA_INK.againstText }}>
        {pathwaysFor(claim, { zeroAgainst: true })}
      </p>
      <p className="mt-1 text-[11.5px] text-[var(--nova-ink-muted)]">{CLAIM_STATE_TEXT[claimStateOf(claim)]}</p>
      {claim.n_against === 0 && (
        <p className="mt-1 text-[11.5px] leading-snug text-[var(--nova-ink-subtle)]">
          0 against — only significant terms are stored, so this does not show that nothing contradicts the claim.
        </p>
      )}
      <ul className="mt-2 space-y-1">
        {top.map((sub) => {
          const side = SIDE[subgroupSide(sub)];
          return (
            <li key={sub.name} className="flex items-baseline gap-2 text-[12px]">
              <span
                className="font-semibold"
                data-direction={sub.obs}
                aria-label={`${sub.obs}-regulated`}
                style={{ color: NOVA_INK.ink }}
              >
                {sub.obs === 'up' ? '↑' : '↓'}
              </span>
              <span style={{ color: side.ink }}>{sub.name}</span>
              <span className="text-[11px] text-[var(--nova-ink-subtle)]">{side.text}</span>
              <span className="ml-auto whitespace-nowrap text-[11px] text-[var(--nova-ink-subtle)]">
                {formatP(sub.nl, 'combined')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Every claim, strongest first: a keyboard- and touch-friendly way to pick a card. */
export function NovaClaimList({
  claims,
  selected,
  onSelect,
}: {
  claims: NovaClaim[];
  selected: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Claims">
      {claims.map((claim) => {
        const color = claimColor(claim.name);
        const active = claim.name === selected;
        return (
          <li key={claim.name}>
            <button
              type="button"
              onClick={() => onSelect(claim.name)}
              aria-pressed={active}
              className="rounded-pill border px-2.5 py-1 text-[12px] transition-colors"
              style={{
                fontFamily: NOVA_FONT,
                color: color.text,
                // A pale tint, not a solid fill: Regeneration's yellow or Soothing's
                // rose would not carry white text.
                background: active ? `${color.fill}26` : 'transparent',
                borderColor: color.fill,
                fontWeight: active ? 600 : 500,
                boxShadow: active ? `inset 0 0 0 1px ${color.fill}` : undefined,
              }}
            >
              {claim.name} · {Math.round(100 * claim.coherence)}%
            </button>
          </li>
        );
      })}
    </ul>
  );
}
