'use client';

import { CosmeticSkinZone } from '@/hooks/useCosmetics';

const ZONE_COLORS: Record<string, string> = {
  stratum_corneum: '#0ea5e9',
  epidermis: '#16a34a',
  dermis: '#db2777',
  inflammation: '#f43f5e',
  antioxidant: '#f59e0b',
  energy: '#ef4444',
  cellular: '#8b5cf6',
};

function opacityFor(activity: number) {
  return 0.12 + (Math.max(0, Math.min(100, activity)) / 100) * 0.78;
}

function DirArrow({ dir }: { dir: string }) {
  if (dir === 'up') return <span style={{ color: '#16a34a' }}>▲</span>;
  if (dir === 'down') return <span style={{ color: '#dc2626' }}>▼</span>;
  return <span style={{ color: '#9ca3af' }}>■</span>;
}

/** Annotated skin cross-section: layers + cross-cutting cellular processes. */
export default function SkinSchematic({ zones }: { zones: CosmeticSkinZone[] }) {
  const byId: Record<string, CosmeticSkinZone> = Object.fromEntries(
    zones.map((z) => [z.slug, z]),
  );
  const layers: Array<{ slug: string; label: string; y: number; h: number }> = [
    { slug: 'stratum_corneum', label: 'Stratum corneum — barrier', y: 20, h: 38 },
    { slug: 'epidermis', label: 'Epidermis — renewal & repair', y: 62, h: 70 },
    { slug: 'dermis', label: 'Dermis — collagen & elasticity', y: 136, h: 150 },
  ];
  const crossCutting = ['inflammation', 'antioxidant', 'energy', 'cellular'].filter(
    (s) => byId[s],
  );

  return (
    <div className="gl-card p-4">
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Effect on skin
      </h3>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Transcriptional engagement per skin compartment. Brighter = more active.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Cross-section */}
        <div className="lg:col-span-3">
          <svg viewBox="0 0 460 300" className="w-full" role="img" aria-label="Skin cross-section">
            {layers.map((l) => {
              const z = byId[l.slug];
              const act = z?.activity ?? 0;
              const color = ZONE_COLORS[l.slug];
              return (
                <g key={l.slug}>
                  <rect
                    x={10}
                    y={l.y}
                    width={300}
                    height={l.h}
                    rx={6}
                    fill={color}
                    fillOpacity={opacityFor(act)}
                    stroke={color}
                    strokeOpacity={0.5}
                  />
                  <text x={20} y={l.y + 18} fontSize={11} fontWeight={600} fill="#1f2937">
                    {l.label}
                  </text>
                  <text x={20} y={l.y + 33} fontSize={10} fill="#4b5563">
                    {act}/100 · {z?.n_pathways ?? 0} pathways
                  </text>
                  {/* connector + value badge */}
                  <line x1={310} y1={l.y + l.h / 2} x2={330} y2={l.y + l.h / 2} stroke={color} strokeWidth={2} />
                  <circle cx={345} cy={l.y + l.h / 2} r={15} fill={color} fillOpacity={0.18} stroke={color} />
                  <text x={345} y={l.y + l.h / 2 + 4} fontSize={11} fontWeight={700} fill={color} textAnchor="middle">
                    {act}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Cross-cutting cellular processes */}
        <div className="lg:col-span-2 flex flex-col gap-2 justify-center">
          {crossCutting.map((slug) => {
            const z = byId[slug];
            const color = ZONE_COLORS[slug];
            return (
              <div key={slug} className="rounded-lg border border-gray-100 p-2.5">
                <div className="flex items-center justify-between text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    {z.label}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]">
                    <DirArrow dir={z.dominant_direction} /> {z.activity}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${z.activity}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
