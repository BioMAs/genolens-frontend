'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { CosmeticClaimScore } from '@/hooks/useCosmetics';
import PanelInfo from './PanelInfo';
import ClaimPathwayMap from './ClaimPathwayMap';

// ── Verdict system ─────────────────────────────────────────────────────────────
// Merges direction + score + confidence into a single readable signal.
// confidence reflects assessment *reliability*, direction reflects *biology*.

interface Verdict {
  label: string;
  icon: string;
  color: string;       // text + border
  bg: string;          // badge background
}

function getVerdict(claim: CosmeticClaimScore): Verdict {
  const { direction, score, confidence, n_contradicting } = claim;

  if (direction === 'favorable') {
    if (score >= 60)
      return { label: 'Supported', icon: '✓', color: '#16a34a', bg: '#dcfce7' };
    if (score >= 30)
      return { label: 'Partial support', icon: '~', color: '#0f766e', bg: '#ccfbf1' };
    return { label: 'Weak signal', icon: '∿', color: '#6b7280', bg: '#f3f4f6' };
  }

  // unfavorable
  if (score >= 50 && confidence === 'HIGH')
    return { label: 'Counteracted', icon: '✗', color: '#dc2626', bg: '#fee2e2' };
  if (n_contradicting > 0)
    return { label: 'Not supported', icon: '✗', color: '#ea580c', bg: '#ffedd5' };
  return { label: 'No signal', icon: '∿', color: '#6b7280', bg: '#f3f4f6' };
}

// ── ClaimCard ──────────────────────────────────────────────────────────────────

interface ClaimCardProps {
  claim: CosmeticClaimScore;
  open: boolean;
  onToggle: () => void;
}

function ClaimCard({ claim, open, onToggle }: ClaimCardProps) {
  const verdict = getVerdict(claim);

  return (
    <div
      className="gl-card flex flex-col gap-3 overflow-hidden"
      style={{ borderLeft: `4px solid ${verdict.color}` }}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: claim.color }} />
            <h4 className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {claim.label}
            </h4>
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            {claim.description}
          </p>
        </div>

        {/* Verdict badge */}
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: verdict.bg, color: verdict.color }}
        >
          {verdict.icon} {verdict.label}
        </span>
      </div>

      {/* ── Score bar ── */}
      <div className="px-4">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold" style={{ color: verdict.color }}>
            {claim.score}
            <span className="text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>/100</span>
          </span>
          {/* Reliability sub-info — small and unobtrusive */}
          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {claim.confidence} reliability
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${claim.score}%`, background: verdict.color }}
          />
        </div>
        <div className="mt-1.5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {claim.n_supporting} supporting · {claim.n_contradicting} contradicting pathways
        </div>
      </div>

      {/* ── Top genes ── */}
      {claim.top_genes.length > 0 && (
        <div className="flex flex-wrap gap-1 px-4">
          {claim.top_genes.slice(0, 6).map((g) => (
            <span
              key={g}
              className="rounded border border-gray-100 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-600"
            >
              {g}
            </span>
          ))}
        </div>
      )}

      {/* ── Expand pathway network ── */}
      {claim.evidence_pathways.length > 0 && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: 'var(--border-default)' }}>
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--sl-teal-dark, #0f766e)' }}
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            {open ? 'Hide' : 'Show'} pathway network
          </button>

          {open && (
            <ClaimPathwayMap
              pathways={claim.evidence_pathways}
              claimLabel={claim.label}
              claimColor={claim.color}
              claimScore={claim.score}
              verdictColor={verdict.color}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── ClaimCards (grid) ──────────────────────────────────────────────────────────

export default function ClaimCards({ claims }: { claims: CosmeticClaimScore[] }) {
  const supported = claims.filter((c) => c.n_supporting > 0 || c.score > 0);
  const list = supported.length > 0 ? supported : claims;

  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const toggle = (slug: string) => setOpenSlug((p) => (p === slug ? null : slug));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Claim details
        </h3>
        <PanelInfo title="Claim details — how to read each card">
          <p>One card per claim, detailing the molecular evidence behind its score.</p>
          <p><b>Verdict badges</b></p>
          <ul>
            <li><b>✓ Supported</b> — the biology clearly moves in the expected direction (score ≥ 60, favorable).</li>
            <li><b>~ Partial support</b> — some evidence in the right direction but signal is moderate.</li>
            <li><b>✗ Counteracted</b> — HIGH-confidence evidence shows the biology moves AGAINST this claim.</li>
            <li><b>✗ Not supported</b> — more contradicting pathways than supporting ones.</li>
            <li><b>∿ No signal / Weak signal</b> — insufficient or very weak evidence.</li>
          </ul>
          <p><b>Reliability</b> (HIGH / MODERATE / LOW) indicates how well the matched pathways are backed by literature — it is independent of whether the claim is supported or not.</p>
          <p><b>Score (0–100)</b> reflects the strength of the evidence signal. A high score with an unfavorable direction means the ingredient strongly and reliably does <em>not</em> support that claim.</p>
        </PanelInfo>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const isOpen = openSlug === c.slug;
          return (
            <div key={c.slug} className={isOpen ? 'col-span-full' : ''}>
              <ClaimCard claim={c} open={isOpen} onToggle={() => toggle(c.slug)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
