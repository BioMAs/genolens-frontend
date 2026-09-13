'use client';

import { CosmeticSkinZone } from '@/hooks/useCosmetics';
import PanelInfo from './PanelInfo';
import { useChartPalette, useChartScales, CHART_VARS } from '@/utils/chartTheme';

/**
 * Les sept compartiments prennent les sept premiers crans de la palette
 * categorielle, dans l'ordre : les trois couches anatomiques d'abord — donc
 * les crans les plus separes entre eux, y compris sous dichromatie — puis les
 * quatre processus transverses.
 *
 * Ils etaient ecrits en dur, et deux d'entre eux reprenaient des couleurs de
 * DIRECTION : `energy: '#ef4444'` (le rouge « sous-exprime ») et
 * `epidermis: '#16a34a'` (le vert « sur-exprime »). Une palette categorielle
 * encode du nominal uniquement ; un compartiment colore en rouge se lisait
 * « reprime » alors que la carte mesure un ENGAGEMENT, pas une direction —
 * distinction que le panneau d'aide prend justement soin d'expliquer.
 */
const ZONE_ORDER = [
  'stratum_corneum', 'epidermis', 'dermis',
  'inflammation', 'antioxidant', 'energy', 'cellular',
];

function opacityFor(activity: number) {
  return 0.12 + (Math.max(0, Math.min(100, activity)) / 100) * 0.78;
}

/** Annotated skin cross-section: layers + cross-cutting cellular processes. */
export default function SkinSchematic({ zones }: { zones: CosmeticSkinZone[] }) {
  const palette = useChartPalette();
  const scales = useChartScales();
  const zoneColor = (slug: string) => {
    const i = ZONE_ORDER.indexOf(slug);
    return i === -1 ? palette.ns : palette.categorical[i % palette.categorical.length];
  };

  /** Troisieme copie de la convention de direction dans le produit. */
  const DirArrow = ({ dir }: { dir: string }) => {
    if (dir === 'up') return <span style={{ color: scales.directionColors.up }}>▲</span>;
    if (dir === 'down') return <span style={{ color: scales.directionColors.down }}>▼</span>;
    return <span style={{ color: palette.ns }}>■</span>;
  };
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
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-body-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Effect on skin
        </h3>
        <PanelInfo title="Effect on skin — how it is computed">
          <p>
            This map shows how strongly each <b>skin compartment</b> is engaged at
            the transcriptional level in this comparison — regardless of whether
            the effect is beneficial.
          </p>
          <p><b>How the activity score is built</b></p>
          <ul>
            <li>Each significantly enriched pathway is mapped to a skin compartment via its functional category (e.g. ECM/cytoskeleton → dermis, barrier lipids → stratum corneum, redox → antioxidant defense).</li>
            <li>Every pathway contributes a weight = <b>evidence strength</b> (HIGH/MODERATE/LOW from the curated referential) × <b>statistical significance</b> (−log₁₀ of the adjusted p-value).</li>
            <li>The weights are summed per compartment, then rescaled <b>0–100 relative to the most engaged compartment</b>.</li>
          </ul>
          <p><b>How to read it</b></p>
          <ul>
            <li><b>Brighter / higher number</b> = more transcriptional activity in that area.</li>
            <li>The <b>arrow</b> shows the dominant direction of regulation (▲ up, ▼ down, ■ mixed).</li>
            <li>This is an <b>engagement</b> view, not a benefit score — see the radar and claim cards for the favorable/unfavorable interpretation.</li>
          </ul>
        </PanelInfo>
      </div>
      <p className="text-caption mb-3" style={{ color: 'var(--text-secondary)' }}>
        Transcriptional engagement per skin compartment. Brighter = more active.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Cross-section */}
        <div className="lg:col-span-3">
          <svg viewBox="0 0 460 300" className="w-full" role="img" aria-label="Skin cross-section">
            {layers.map((l) => {
              const z = byId[l.slug];
              const act = z?.activity ?? 0;
              const color = zoneColor(l.slug);
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
                  <text x={20} y={l.y + 18} fontSize={11} fontWeight={600} fill={CHART_VARS.ink}>
                    {l.label}
                  </text>
                  <text x={20} y={l.y + 33} fontSize={10} fill={CHART_VARS.inkMuted}>
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
            const color = zoneColor(slug);
            return (
              <div key={slug} className="rounded-control border border-subtle p-2.5">
                <div className="flex items-center justify-between text-caption font-medium" style={{ color: 'var(--text-primary)' }}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-pill" style={{ background: color }} />
                    {z.label}
                  </span>
                  <span className="flex items-center gap-1 text-micro">
                    <DirArrow dir={z.dominant_direction} /> {z.activity}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-pill bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-pill" style={{ width: `${z.activity}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
