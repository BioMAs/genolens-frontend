'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useProjectSummary, ComparisonSummary } from '@/hooks/useProjectData';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import { useUserProfile } from '@/hooks/useUserProfile';
import { claimColor, NOVA_INK } from '@/components/cosmomics/novaPalette';
import type { CosmOmicsNovaData } from '@/types/cosmomics';

/**
 * JumpBackInCard — dashboard "Jump back in" panel from the redesign (2a/4b).
 * Surfaces the most recent comparison with its CosmOmics read: the strongest
 * claims and how coherent their pathway evidence is, a plain-language verdict
 * and claim pills. Falls back to DEG counts when the add-on is locked or the
 * nova has no claim.
 */

/** Claims whose evidence is mostly for them, strongest first (the nova's sector order). */
function supportedClaims(nova: CosmOmicsNovaData) {
  return nova.claims.filter((c) => c.n_for > 0 && c.coherence >= 0.5);
}

function buildVerdict(nova: CosmOmicsNovaData): string {
  const names = supportedClaims(nova)
    .slice(0, 3)
    .map((c) => c.name.toLowerCase());
  if (!names.length) return 'Mixed pathway evidence across cosmetic claims';
  if (names.length === 1) return `${names[0][0].toUpperCase()}${names[0].slice(1)}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`.replace(/^./, (m) => m.toUpperCase());
}

function pickComparison(comps: ComparisonSummary[]): ComparisonSummary | undefined {
  return comps.find((c) => c.has_enrichment) ?? comps[0];
}

export default function JumpBackInCard({ projectId }: { projectId: string }) {
  const { data: profile } = useUserProfile();
  // The CosmOmics read is shown ONLY when the Skin claims add-on is active for the user.
  const skinActive = profile?.has_cosmetics_module === true;

  const { data: summary } = useProjectSummary(projectId);
  const comp = pickComparison(summary?.comparisons ?? []);

  const { data: nova } = useCosmOmicsNova(comp?.dataset_id, comp?.name, skinActive && !!comp);

  if (!comp) return null;

  const href = `/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}`;
  const hasNova = skinActive && !!nova && nova.claims.length > 0;
  const topClaims = (nova?.claims ?? []).slice(0, 3);
  const title = comp.name.replace(/_?vs_?/i, ' vs ');

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-body font-semibold" style={{ color: 'var(--text-primary)' }}>Jump back in</h3>
        <span className="text-micro" style={{ color: 'var(--text-muted)' }}>Your last result — go straight to what matters</span>
      </div>

      <div
        className="grid grid-cols-1 items-center gap-6 rounded-card border p-6 lg:grid-cols-[1.15fr_1px_1fr_auto]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 1px 2px rgba(19,22,41,.04)' }}
      >
        {/* Left — identity + claim coherence (or DEG bars) */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded-sm px-2 py-0.5 text-micro tracking-[0.5px]"
              style={{ background: 'var(--sl-teal-light)', color: 'var(--sl-teal)' }}
            >
              DONE
            </span>
            {comp.has_enrichment && (
              <span className="text-micro" style={{ color: 'var(--text-muted)' }}>Enrichment ready</span>
            )}
          </div>
          <div className="font-display text-body font-semibold leading-[1.3] tracking-[-0.3px]" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {hasNova ? (
              topClaims.map((claim) => {
                const color = claimColor(claim.name);
                const coherence = Math.round(100 * claim.coherence);
                return (
                  <div key={claim.name} className="flex items-center gap-3">
                    <span className="w-24 truncate text-micro" style={{ color: color.text }}>{claim.name}</span>
                    <div className="h-[7px] flex-1 overflow-hidden rounded-sm" style={{ background: 'var(--n-100)' }}>
                      <div
                        className="h-full rounded-sm"
                        style={{ width: `${coherence}%`, background: coherence >= 50 ? NOVA_INK.green : NOVA_INK.against }}
                      />
                    </div>
                    <span className="w-10 text-right text-micro" style={{ color: 'var(--text-muted)' }}>{coherence}%</span>
                  </div>
                );
              })
            ) : (
              <div>
                <div className="mb-2 flex justify-between text-micro" style={{ color: 'var(--text-muted)' }}>
                  <span>{comp.deg_total.toLocaleString()} DEGs</span>
                  <span>{comp.deg_up} up · {comp.deg_down} down</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-sm" style={{ background: 'var(--n-100)' }}>
                  <div style={{ width: `${comp.deg_total ? (comp.deg_up / comp.deg_total) * 100 : 50}%`, background: 'var(--dc-up)' }} />
                  <div style={{ width: `${comp.deg_total ? (comp.deg_down / comp.deg_total) * 100 : 50}%`, background: 'var(--dc-down)' }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider (lg only) */}
        <div className="hidden h-full w-px lg:block" style={{ background: 'var(--border-subtle)' }} />

        {/* Middle — verdict + claim pills */}
        <div>
          <div className="mb-2 text-micro uppercase tracking-[0.5px]" style={{ color: 'var(--sl-teal)' }}>
            {hasNova ? 'CosmOmics verdict' : 'Results'}
          </div>
          {hasNova ? (
            <>
              <div className="mb-3 font-display text-body-sm font-semibold leading-[1.35]" style={{ color: 'var(--text-primary)' }}>
                {buildVerdict(nova!)}
              </div>
              <div className="flex flex-wrap gap-2">
                {topClaims.map((claim) => {
                  const color = claimColor(claim.name).fill;
                  return (
                    <span
                      key={claim.name}
                      className="flex items-center gap-2 rounded-pill border px-2.5 py-1 text-micro"
                      style={{
                        background: `color-mix(in oklab, ${color} 8%, var(--surface))`,
                        borderColor: `color-mix(in oklab, ${color} 22%, var(--surface))`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      <span className="h-2 w-2 rounded-pill" style={{ background: color }} />
                      {claim.name} · {claim.n_for} for · {claim.n_against} against
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-body-sm font-semibold leading-[1.35]" style={{ color: 'var(--text-primary)' }}>
                {comp.deg_total.toLocaleString()} differentially expressed genes
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-pill px-2.5 py-1 text-micro" style={{ background: 'var(--sl-teal-light)', color: 'var(--dc-up-dark)' }}>
                  {comp.deg_up} up
                </span>
                <span className="rounded-pill px-2.5 py-1 text-micro" style={{ background: 'var(--sl-red-light)', color: 'var(--dc-down-dark)' }}>
                  {comp.deg_down} down
                </span>
                <span
                  className="rounded-pill px-2.5 py-1 text-micro"
                  style={{ background: 'var(--sl-purple-light)', color: 'var(--sl-purple)' }}
                >
                  {comp.has_enrichment ? 'Pathway enrichment ready' : 'Enrichment not run'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex flex-col items-stretch gap-3">
          <Link
            href={href}
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-card px-5 py-3 text-body-sm font-semibold text-on-accent"
            style={{ background: 'var(--sl-purple)', boxShadow: '0 8px 18px -8px rgba(79,70,229,.6)' }}
          >
            View results <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={href}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-card border px-5 py-2.5 text-body-sm font-semibold"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Generate report
          </Link>
        </div>
      </div>
    </section>
  );
}
