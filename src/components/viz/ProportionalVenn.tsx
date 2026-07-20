'use client';

/**
 * ProportionalVenn — bespoke SVG Venn for 2–3 gene sets, matching the redesign's
 * multi-comparison hero. Circles are tinted per set; every region shows its
 * distinct-intersection gene count, and clicking a region selects it (genes +
 * label) so the caller can inspect / enrich it. For 4–5 sets the caller should
 * fall back to an UpSet plot.
 */

export interface VennRegion {
  /** Human-readable region name, e.g. "A ∩ B" or "Shared by all". */
  name: string;
  genes: string[];
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
  color: string;
  label: string;
  labelPos: { x: number; y: number; anchor: 'start' | 'middle' | 'end' };
}

const PALETTE = ['var(--dc-indigo)', 'var(--dc-pink)', 'var(--dc-green)', 'var(--dc-amber)'];

function intersect(a: string[], b: Set<string>): string[] {
  return a.filter((g) => b.has(g));
}

/** Distinct-intersection regions + circle geometry for 2 or 3 sets. */
function build(setGenes: Record<string, string[]>) {
  const labels = Object.keys(setGenes);
  const sets = labels.map((l) => new Set(setGenes[l]));

  const regions: Array<{ key: string; name: string; genes: string[]; x: number; y: number; big?: boolean }> = [];

  if (labels.length === 2) {
    const [A, B] = labels;
    const [sA, sB] = sets;
    const aOnly = setGenes[A].filter((g) => !sB.has(g));
    const bOnly = setGenes[B].filter((g) => !sA.has(g));
    const ab = intersect(setGenes[A], sB);
    regions.push(
      { key: 'a', name: A, genes: aOnly, x: 150, y: 190 },
      { key: 'b', name: B, genes: bOnly, x: 350, y: 190 },
      { key: 'ab', name: `${A} ∩ ${B}`, genes: ab, x: 250, y: 190, big: true },
    );
    const circles: Circle[] = [
      { cx: 200, cy: 190, r: 130, color: PALETTE[0], label: A, labelPos: { x: 90, y: 60, anchor: 'start' } },
      { cx: 300, cy: 190, r: 130, color: PALETTE[1], label: B, labelPos: { x: 410, y: 60, anchor: 'end' } },
    ];
    return { circles, regions, labels };
  }

  // 3 sets
  const [A, B, C] = labels;
  const [sA, sB, sC] = sets;
  const aOnly = setGenes[A].filter((g) => !sB.has(g) && !sC.has(g));
  const bOnly = setGenes[B].filter((g) => !sA.has(g) && !sC.has(g));
  const cOnly = setGenes[C].filter((g) => !sA.has(g) && !sB.has(g));
  const ab = setGenes[A].filter((g) => sB.has(g) && !sC.has(g));
  const ac = setGenes[A].filter((g) => sC.has(g) && !sB.has(g));
  const bc = setGenes[B].filter((g) => sC.has(g) && !sA.has(g));
  const abc = setGenes[A].filter((g) => sB.has(g) && sC.has(g));
  regions.push(
    { key: 'a', name: A, genes: aOnly, x: 150, y: 140 },
    { key: 'b', name: B, genes: bOnly, x: 350, y: 140 },
    { key: 'c', name: C, genes: cOnly, x: 250, y: 315 },
    { key: 'ab', name: `${A} ∩ ${B}`, genes: ab, x: 250, y: 120 },
    { key: 'ac', name: `${A} ∩ ${C}`, genes: ac, x: 180, y: 240 },
    { key: 'bc', name: `${B} ∩ ${C}`, genes: bc, x: 320, y: 240 },
    { key: 'abc', name: 'Shared by all 3', genes: abc, x: 250, y: 195, big: true },
  );
  const circles: Circle[] = [
    { cx: 195, cy: 165, r: 120, color: PALETTE[0], label: A, labelPos: { x: 70, y: 55, anchor: 'start' } },
    { cx: 305, cy: 165, r: 120, color: PALETTE[1], label: B, labelPos: { x: 430, y: 55, anchor: 'end' } },
    { cx: 250, cy: 270, r: 120, color: PALETTE[2], label: C, labelPos: { x: 250, y: 405, anchor: 'middle' } },
  ];
  return { circles, regions, labels };
}

interface Props {
  setGenes: Record<string, string[]>;
  selectedName?: string | null;
  onSelect: (region: VennRegion) => void;
}

export default function ProportionalVenn({ setGenes, selectedName, onSelect }: Props) {
  const { circles, regions } = build(setGenes);

  return (
    <svg viewBox="0 0 500 420" className="w-full max-w-[500px]" role="img" aria-label="Venn diagram">
      {circles.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill={c.color}
            fillOpacity={0.2}
            stroke={c.color}
            strokeOpacity={0.55}
            strokeWidth={1.5}
          />
          <text
            x={c.labelPos.x}
            y={c.labelPos.y}
            textAnchor={c.labelPos.anchor}
            className="font-display"
            fontSize={13}
            fontWeight={700}
            fill="var(--text-primary)"
          >
            {c.label.length > 18 ? c.label.slice(0, 17) + '…' : c.label}
          </text>
        </g>
      ))}

      {regions.map((r) => {
        const selected = selectedName === r.name;
        return (
          <g
            key={r.key}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelect({ name: r.name, genes: r.genes })}
          >
            {r.big && (
              <circle cx={r.x} cy={r.y} r={26} fill="var(--text-primary)" opacity={selected ? 1 : 0.88} />
            )}
            {selected && !r.big && <circle cx={r.x} cy={r.y} r={20} fill="var(--sl-purple-light)" />}
            <text
              x={r.x}
              y={r.big ? r.y + 2 : r.y + 1}
              textAnchor="middle"
              className="font-display"
              fontSize={r.big ? 20 : 15}
              fontWeight={700}
              fill={r.big ? '#fff' : 'var(--text-primary)'}
            >
              {r.genes.length}
            </text>
            {r.big && (
              <text x={r.x} y={r.y + 42} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--sl-teal)" letterSpacing="0.5">
                ALL {Object.keys(setGenes).length}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
