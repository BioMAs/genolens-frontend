'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useProjectSummary, ComparisonSummary } from '@/hooks/useProjectData';
import { useCosmeticsData, useUserProfile, CosmeticsResult } from '@/hooks/useCosmetics';

/**
 * JumpBackInCard — dashboard "Jump back in" panel from the redesign (2a/4b).
 * Surfaces the most recent comparison with a mini Skin Stack, a plain-language
 * verdict and top claim pills. Falls back to DEG counts when the cosmetics
 * module is locked or no skin data is available.
 */

const LAYERS = [
  { slug: 'stratum_corneum', label: 'Barrier', color: 'var(--dc-skin-barrier)', fill: 'var(--dc-skin-barrier-fill)' },
  { slug: 'epidermis', label: 'Epidermis', color: 'var(--dc-skin-epidermis)', fill: 'var(--dc-green)' },
  { slug: 'dermis', label: 'Dermis', color: 'var(--dc-skin-dermis)', fill: 'var(--dc-pink)' },
];

function buildVerdict(cos: CosmeticsResult): string {
  const fav = cos.claims.filter((c) => c.direction === 'favorable' && c.score > 0).sort((a, b) => b.score - a.score);
  if (!fav.length) return 'Mixed transcriptional signal across skin claims';
  const labels = fav.slice(0, 3).map((c) => c.label.toLowerCase());
  if (labels.length === 1) return `${labels[0][0].toUpperCase()}${labels[0].slice(1)}`;
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`.replace(/^./, (m) => m.toUpperCase());
}

function pickComparison(comps: ComparisonSummary[]): ComparisonSummary | undefined {
  return comps.find((c) => c.has_enrichment) ?? comps[0];
}

export default function JumpBackInCard({ projectId }: { projectId: string }) {
  const { data: profile } = useUserProfile();
  const unlocked =
    !!profile &&
    (profile.role === 'ADMIN' || profile.role === 'SCILICIUM_ADMIN' || profile.has_cosmetics_module === true);

  const { data: summary } = useProjectSummary(projectId);
  const comp = pickComparison(summary?.comparisons ?? []);

  const { data: cos } = useCosmeticsData(comp?.dataset_id, comp?.name, unlocked && !!comp);

  if (!comp) return null;

  const href = `/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}`;
  const zonesById = Object.fromEntries((cos?.skin_zones ?? []).map((z) => [z.slug, z]));
  const hasSkin = unlocked && !!cos && cos.skin_zones.length > 0;
  const topClaims = [...(cos?.claims ?? [])].filter((c) => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  const title = comp.name.replace(/_?vs_?/i, ' vs ');

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Jump back in</h3>
        <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Your last result — go straight to what matters</span>
      </div>

      <div
        className="grid grid-cols-1 items-center gap-6 rounded-[18px] border p-6 lg:grid-cols-[1.15fr_1px_1fr_auto]"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 1px 2px rgba(19,22,41,.04)' }}
      >
        {/* Left — identity + mini skin stack (or DEG bars) */}
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span
              className="rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-[0.5px]"
              style={{ background: 'var(--sl-teal-light)', color: 'var(--sl-teal)' }}
            >
              DONE
            </span>
            {comp.has_enrichment && (
              <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>Enrichment ready</span>
            )}
          </div>
          <div className="font-display text-[16.5px] font-semibold leading-[1.3] tracking-[-0.3px]" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>

          <div className="mt-3.5 flex flex-col gap-1.5">
            {hasSkin ? (
              LAYERS.map((l) => {
                const act = Math.max(0, Math.min(100, zonesById[l.slug]?.activity ?? 0));
                return (
                  <div key={l.slug} className="flex items-center gap-2.5">
                    <span className="w-20 text-[11px]" style={{ color: l.color }}>{l.label}</span>
                    <div className="h-[7px] flex-1 overflow-hidden rounded" style={{ background: 'var(--n-100)' }}>
                      <div className="h-full rounded" style={{ width: `${act}%`, background: l.fill }} />
                    </div>
                    <span className="w-8 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>{act.toFixed(1)}</span>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center gap-4 text-xs font-medium">
                <span style={{ color: 'var(--dc-up-dark)' }}>▲ {comp.deg_up} up</span>
                <span style={{ color: 'var(--dc-down-dark)' }}>▼ {comp.deg_down} down</span>
                <span style={{ color: 'var(--text-muted)' }}>{comp.deg_total} total DEGs</span>
              </div>
            )}
          </div>
        </div>

        {/* Divider (lg only) */}
        <div className="hidden h-full w-px lg:block" style={{ background: 'var(--border-subtle)' }} />

        {/* Middle — verdict + claim pills */}
        <div>
          <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.5px]" style={{ color: 'var(--sl-teal)' }}>
            Verdict
          </div>
          {hasSkin ? (
            <>
              <div className="mb-3 font-display text-[14.5px] font-semibold leading-[1.35]" style={{ color: 'var(--text-primary)' }}>
                {buildVerdict(cos!)}
              </div>
              <div className="flex flex-wrap gap-2">
                {topClaims.map((c) => (
                  <span
                    key={c.slug}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${c.color} 8%, var(--surface))`,
                      borderColor: `color-mix(in oklab, ${c.color} 22%, var(--surface))`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.label} {Math.round(c.score)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="font-display text-[14.5px] font-semibold leading-[1.35]" style={{ color: 'var(--text-primary)' }}>
              {comp.deg_total} differentially expressed genes
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex flex-col items-stretch gap-2.5">
          <Link
            href={href}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-5 py-3 text-[13.5px] font-semibold text-white"
            style={{ background: 'var(--sl-purple)', boxShadow: '0 8px 18px -8px rgba(79,70,229,.6)' }}
          >
            View results <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={href}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-xl border px-5 py-2.5 text-[13px] font-semibold"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
          >
            Generate report
          </Link>
        </div>
      </div>
    </section>
  );
}
