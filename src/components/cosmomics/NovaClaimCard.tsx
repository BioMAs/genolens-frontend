import type { NovaClaim } from '@/types/cosmomics';
import { formatP } from './novaLayout';
import { NOVA_INK, claimColor } from './novaPalette';
import { NOVA_FONT } from './CosmOmicsNova';

/**
 * Claim card of the reference poster (`blocks()`): coherence bar, pathways for /
 * against, and the three most significant sub-groups. The arrow gives the
 * observed direction; it is green (up) or coral (down) when the sub-group
 * supports the claim, grey when it contradicts it.
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
        >
          <div
            className="h-full rounded-pill"
            style={{ width: `${coherence}%`, background: good ? NOVA_INK.green : NOVA_INK.against }}
          />
        </div>
        <span className="text-[13px] text-[var(--nova-ink-muted)]">coherence {coherence}%</span>
      </div>
      <p className="mt-2 text-[12.5px]" style={{ color: good ? NOVA_INK.ink : NOVA_INK.againstText }}>
        {claim.n_for} pathway{claim.n_for === 1 ? '' : 's'} for · {claim.n_against} against
      </p>
      <ul className="mt-2 space-y-1">
        {top.map((sub) => {
          const supports = sub.delta > 0;
          const arrowColor = supports ? (sub.obs === 'up' ? NOVA_INK.green : NOVA_INK.coral) : NOVA_INK.againstText;
          return (
            <li key={sub.name} className="flex items-baseline gap-2 text-[12px]">
              <span
                className="font-semibold"
                style={{ color: arrowColor }}
                aria-label={`${sub.obs === 'up' ? 'up' : 'down'}-regulated, ${supports ? 'supports' : 'contradicts'} the claim`}
              >
                {sub.obs === 'up' ? '↑' : '↓'}
              </span>
              <span style={{ color: supports ? NOVA_INK.ink : NOVA_INK.againstText }}>{sub.name}</span>
              <span className="ml-auto whitespace-nowrap text-[11px] text-[var(--nova-ink-subtle)]">{formatP(sub.nl)}</span>
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
