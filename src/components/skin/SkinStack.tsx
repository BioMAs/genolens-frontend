'use client';

import { CosmeticSkinZone } from '@/hooks/useCosmetics';

/**
 * SkinStack — the redesign's hero "skin read": the three anatomical skin
 * compartments as stacked bars whose fill encodes transcriptional activity.
 * Data comes straight from the /cosmetics `skin_zones` payload.
 */

interface LayerConfig {
  slug: string;
  name: string;
  sub: string;
  color: string; // CSS var / hex used for fill + score text
  height: number;
}

const LAYERS: LayerConfig[] = [
  { slug: 'stratum_corneum', name: 'Stratum corneum', sub: 'barrier', color: 'var(--dc-skin-barrier)', height: 74 },
  { slug: 'epidermis', name: 'Epidermis', sub: 'renewal & repair', color: 'var(--dc-skin-epidermis)', height: 92 },
  { slug: 'dermis', name: 'Dermis', sub: 'collagen & elasticity', color: 'var(--dc-skin-dermis)', height: 112 },
];

export default function SkinStack({ zones }: { zones: CosmeticSkinZone[] }) {
  const byId: Record<string, CosmeticSkinZone> = Object.fromEntries(zones.map((z) => [z.slug, z]));
  const present = LAYERS.filter((l) => byId[l.slug]);
  const layers = present.length ? present : LAYERS;
  const mostActiveSlug = layers
    .map((l) => ({ slug: l.slug, a: byId[l.slug]?.activity ?? 0 }))
    .sort((x, y) => y.a - x.a)[0]?.slug;

  return (
    <div>
      <div className="mb-3.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
        Transcriptional activity by skin compartment —{' '}
        <b style={{ color: 'var(--text-primary)' }}>deeper fill = more active</b>
      </div>
      <div className="flex flex-col gap-2.5">
        {layers.map((l) => {
          const z = byId[l.slug];
          const act = Math.max(0, Math.min(100, z?.activity ?? 0));
          const fill = `color-mix(in oklab, ${l.color} 22%, var(--surface))`;
          return (
            <div
              key={l.slug}
              className="relative overflow-hidden rounded-[14px] border"
              style={{
                height: l.height,
                borderColor: `color-mix(in oklab, ${l.color} 32%, var(--surface))`,
              }}
            >
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(90deg, ${fill} ${act}%, var(--surface-secondary) ${act}%)` }}
              />
              <div className="relative flex h-full items-center justify-between px-[18px]">
                <div>
                  <div className="text-[14.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {l.name}{' '}
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                      — {l.sub}
                    </span>
                  </div>
                  <div className="mt-[3px] text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                    {z?.n_pathways ?? 0} pathways engaged
                    {l.slug === mostActiveSlug && (act > 0) ? ' · most active layer' : ''}
                  </div>
                </div>
                <div className="flex items-baseline gap-0.5" style={{ color: l.color }}>
                  <span className="font-display text-[26px] font-bold leading-none">{act.toFixed(1)}</span>
                  <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>/100</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
