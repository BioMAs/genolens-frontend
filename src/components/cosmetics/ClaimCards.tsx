'use client';

import { useState } from 'react';
import { ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import { CosmeticClaimScore } from '@/hooks/useCosmetics';
import PanelInfo from './PanelInfo';
import ClaimPathwayMap from './ClaimPathwayMap';

const CONFIDENCE_STYLES: Record<string, { bg: string; fg: string }> = {
  HIGH: { bg: '#dcfce7', fg: '#166534' },
  MODERATE: { bg: '#fef9c3', fg: '#854d0e' },
  LOW: { bg: '#f3f4f6', fg: '#6b7280' },
};

function ClaimCard({ claim }: { claim: CosmeticClaimScore }) {
  const [open, setOpen] = useState(false);
  const conf = CONFIDENCE_STYLES[claim.confidence] ?? CONFIDENCE_STYLES.LOW;
  const favorable = claim.direction === 'favorable';

  return (
    <div className="gl-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: claim.color }}
            />
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {claim.label}
            </h4>
          </div>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {claim.description}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: conf.bg, color: conf.fg }}
        >
          {claim.confidence}
        </span>
      </div>

      {/* Gauge */}
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold" style={{ color: claim.color }}>
            {claim.score}
            <span className="text-sm font-normal text-gray-400">/100</span>
          </span>
          <span
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: favorable ? '#16a34a' : '#dc2626' }}
          >
            {favorable ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {favorable ? 'Favorable' : 'Unfavorable'}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${claim.score}%`, background: claim.color }}
          />
        </div>
        <div className="mt-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {claim.n_supporting} supporting · {claim.n_contradicting} contradicting pathways
        </div>
      </div>

      {claim.top_genes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {claim.top_genes.slice(0, 6).map((g) => (
            <span
              key={g}
              className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-mono text-gray-600 border border-gray-100"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {claim.evidence_pathways.length > 0 && (
        <div>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--sl-teal-dark, #0f766e)' }}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
            {open ? 'Hide' : 'Show'} pathway network
          </button>
          {open && (
            <ClaimPathwayMap
              pathways={claim.evidence_pathways}
              claimLabel={claim.label}
              claimColor={claim.color}
              claimScore={claim.score}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function ClaimCards({ claims }: { claims: CosmeticClaimScore[] }) {
  const supported = claims.filter((c) => c.n_supporting > 0 || c.score > 0);
  const list = supported.length > 0 ? supported : claims;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Claim details
        </h3>
        <PanelInfo title="Claim details — how to read each card">
          <p>One card per claim, detailing the evidence behind its score.</p>
          <p><b>What each element means</b></p>
          <ul>
            <li><b>Score (0–100)</b> + bar: the claim activation score (consistency × strength of the supporting evidence).</li>
            <li><b>Favorable / Unfavorable</b>: whether the net of supporting vs contradicting pathways points in the claim&apos;s direction.</li>
            <li><b>Confidence badge</b> (HIGH/MODERATE/LOW): based on the literature evidence level of the matched pathways and how many support the claim.</li>
            <li><b>Supporting vs contradicting pathways</b>: how many enriched pathways agree vs disagree with the claim&apos;s expected direction.</li>
            <li><b>Gene chips</b>: representative genes driving the matched pathways.</li>
            <li><b>Evidence pathways</b> (expandable): the actual pathways behind the score, with their observed direction and evidence level.</li>
          </ul>
          <p><b>How to read it</b></p>
          <ul>
            <li>Prioritize claims with a <b>high score AND HIGH/MODERATE confidence</b> for communication.</li>
            <li>A high score with LOW confidence or few supporting pathways is <b>exploratory</b> — treat with caution.</li>
          </ul>
        </PanelInfo>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => (
          <ClaimCard key={c.slug} claim={c} />
        ))}
      </div>
    </div>
  );
}
