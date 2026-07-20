'use client';

import { CosmeticClaimScore } from '@/hooks/useCosmetics';

/**
 * PathwayThemeGroups — "metabolic pathways driving the effect", grouped by the
 * cosmetic claim (theme) they support. Built client-side from each claim's
 * `evidence_pathways` (the interim approach until the backend exposes a themed
 * enrichment grouping endpoint).
 */

function isUp(dir: string) {
  return dir?.toLowerCase().startsWith('up') || dir === '+';
}

function ThemeBlock({ claim }: { claim: CosmeticClaimScore }) {
  const color = claim.color || 'var(--sl-violet)';
  const pathways = [...claim.evidence_pathways]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  const maxWeight = Math.max(...pathways.map((p) => p.weight), 1);
  const favorable = claim.direction === 'favorable';

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />
        <span className="text-[13.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {claim.label}
        </span>
        <span
          className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: favorable ? 'var(--sl-teal-light)' : 'var(--sl-red-light)',
            color: favorable ? 'var(--dc-up-dark)' : 'var(--dc-down-dark)',
          }}
        >
          {favorable ? '▲' : '▼'} {Math.round(claim.score)}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {pathways.map((p) => {
          const up = isUp(p.direction);
          const pct = Math.round((p.weight / maxWeight) * 100);
          return (
            <div key={p.term_id} className="flex items-center gap-3">
              <span
                className="w-[34px] flex-none rounded-[5px] py-[3px] text-center text-[10px] font-bold"
                style={{
                  background: up ? 'var(--sl-teal-light)' : 'var(--sl-red-light)',
                  color: up ? 'var(--dc-up-dark)' : 'var(--dc-down-dark)',
                }}
              >
                {up ? 'UP' : 'DN'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {p.pathway_name}{' '}
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {p.term_id}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded"
                  style={{ background: 'var(--n-100)' }}
                >
                  <div
                    className="h-full rounded"
                    style={{ width: `${pct}%`, background: up ? 'var(--dc-up)' : 'var(--dc-down)' }}
                  />
                </div>
              </div>
              <span className="w-[64px] flex-none text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
                padj {p.padj < 0.001 ? '<0.001' : p.padj.toFixed(3)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PathwayThemeGroups({ claims }: { claims: CosmeticClaimScore[] }) {
  const themes = [...claims]
    .filter((c) => c.evidence_pathways.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!themes.length) return null;

  return (
    <div className="gl-card p-6">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h3 className="font-display text-[17px] font-semibold tracking-[-0.3px]" style={{ color: 'var(--text-primary)' }}>
            Metabolic pathways driving the effect
          </h3>
          <div className="mt-1.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
            Grouped by cosmetic claim · ranked by evidence weight
          </div>
        </div>
        <div className="flex gap-4 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded" style={{ background: 'var(--dc-up)' }} />
            Up-regulated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded" style={{ background: 'var(--dc-down)' }} />
            Down-regulated
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {themes.map((c) => (
          <ThemeBlock key={c.slug} claim={c} />
        ))}
      </div>
    </div>
  );
}
