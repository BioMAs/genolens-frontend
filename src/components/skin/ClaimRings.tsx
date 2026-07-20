'use client';

import { CosmeticClaimScore } from '@/hooks/useCosmetics';

/**
 * ClaimRings — top cosmetic claims rendered as circular activation-score rings
 * (0–100), matching the redesign hero. Colors come from each claim's own
 * `color` field returned by the backend.
 */

const R = 40;
const CIRC = 2 * Math.PI * R;

function Ring({ claim }: { claim: CosmeticClaimScore }) {
  const score = Math.max(0, Math.min(100, claim.score));
  const color = claim.color || 'var(--sl-violet)';
  const offset = CIRC * (1 - score / 100);
  const favorable = claim.direction === 'favorable';

  return (
    <div
      className="flex-1 rounded-2xl border p-[18px] px-3.5 text-center"
      style={{
        background: `color-mix(in oklab, ${color} 7%, var(--surface))`,
        borderColor: `color-mix(in oklab, ${color} 22%, var(--surface))`,
      }}
    >
      <div className="relative mx-auto h-24 w-24">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            strokeWidth="9"
            stroke={`color-mix(in oklab, ${color} 22%, var(--surface))`}
          />
          <circle
            cx="48"
            cy="48"
            r={R}
            fill="none"
            strokeWidth="9"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            transform="rotate(-90 48 48)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-[22px] font-bold" style={{ color }}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      <div className="mt-2.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {claim.label}
      </div>
      <div
        className="mt-1 text-[11px] font-semibold"
        style={{ color: favorable ? 'var(--dc-up-dark)' : '#d97706' }}
      >
        {favorable ? '↗ Favorable' : '↘ To watch'}
      </div>
    </div>
  );
}

export default function ClaimRings({ claims, max = 3 }: { claims: CosmeticClaimScore[]; max?: number }) {
  const top = [...claims]
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max);

  if (!top.length) {
    return (
      <div className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
        No claim reached a significant activation score for this comparison.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
        Top skin claims — <b style={{ color: 'var(--text-primary)' }}>activation score, 0–100</b>
      </div>
      <div className="flex gap-3.5">
        {top.map((c) => (
          <Ring key={c.slug} claim={c} />
        ))}
      </div>
    </div>
  );
}
