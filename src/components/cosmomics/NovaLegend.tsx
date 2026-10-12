import { NOVA_FONT, HatchPattern } from './CosmOmicsNova';
import { NOVA_INK, claimColor } from './novaPalette';

/** The five legend entries of the reference figure, in its order and wording. */
export const LEGEND_TEXT = {
  subgroup: 'Sub-group: terms for → against the claim',
  term: 'Individual ontology term',
  hatch: 'Evidence against the claim (hatched)',
  size: 'Size = |Δ pro − anti|',
  width: 'Sector width = claim importance (Σ −log10 p of its terms)',
} as const;

const SECTOR_SWATCH = claimColor('Firming').fill;

/** Reference legend as SVG, for the exported figure (reference `legend(y)`). */
export function NovaLegendSvg({ y, footer, hatchId }: { y: number; footer: string; hatchId: string }) {
  const y2 = y + 22;
  const text = (x: number, ty: number, s: string) => (
    <text x={x} y={ty} fontSize={13} fill={NOVA_INK.ink}>
      {s}
    </text>
  );
  return (
    <g fontFamily={NOVA_FONT}>
      <circle cx={56} cy={y - 5} r={6} fill={NOVA_INK.green} />
      <circle cx={70} cy={y - 5} r={6} fill={NOVA_INK.neutral} />
      <circle cx={84} cy={y - 5} r={6} fill={NOVA_INK.coral} />
      {text(96, y, LEGEND_TEXT.subgroup)}
      <circle cx={380} cy={y - 5} r={2.2} fill={NOVA_INK.green} />
      <circle cx={388} cy={y - 5} r={2.2} fill={NOVA_INK.coral} />
      {text(398, y, LEGEND_TEXT.term)}
      <rect x={580} y={y - 11} width={18} height={12} fill={`url(#${hatchId})`} stroke={NOVA_INK.against} />
      {text(604, y, LEGEND_TEXT.hatch)}
      <circle cx={56} cy={y2 - 5} r={3.5} fill={NOVA_INK.against} />
      <circle cx={70} cy={y2 - 5} r={6} fill={NOVA_INK.against} />
      {text(84, y2, LEGEND_TEXT.size)}
      <path d={`M262,${y2} L280,${y2 - 14} A22,22 0 0 1 284,${y2 - 1} Z`} fill={SECTOR_SWATCH} opacity={0.5} />
      {text(288, y2, LEGEND_TEXT.width)}
      <text x={950} y={y2} fontSize={11} fill={NOVA_INK.againstText} textAnchor="end">
        {footer}
      </text>
    </g>
  );
}

function Swatch({ children, width = 44 }: { children: React.ReactNode; width?: number }) {
  return (
    <svg width={width} height={14} viewBox={`0 0 ${width} 14`} aria-hidden className="shrink-0">
      {children}
    </svg>
  );
}

/** Same legend, as wrapping HTML for the page (stays readable at phone width). */
export default function NovaLegend({ hatchId }: { hatchId: string }) {
  return (
    <ul
      className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-[#3A4150]"
      aria-label="Legend"
      style={{ fontFamily: NOVA_FONT }}
    >
      <li className="flex items-center gap-2">
        <Swatch>
          <circle cx={7} cy={7} r={6} fill={NOVA_INK.green} />
          <circle cx={21} cy={7} r={6} fill={NOVA_INK.neutral} />
          <circle cx={35} cy={7} r={6} fill={NOVA_INK.coral} />
        </Swatch>
        {LEGEND_TEXT.subgroup}
      </li>
      <li className="flex items-center gap-2">
        <Swatch width={16}>
          <circle cx={4} cy={7} r={2.2} fill={NOVA_INK.green} />
          <circle cx={12} cy={7} r={2.2} fill={NOVA_INK.coral} />
        </Swatch>
        {LEGEND_TEXT.term}
      </li>
      <li className="flex items-center gap-2">
        <Swatch width={20}>
          <defs>
            <HatchPattern id={`${hatchId}-legend`} />
          </defs>
          <rect x={1} y={1} width={18} height={12} fill={`url(#${hatchId}-legend)`} stroke={NOVA_INK.against} />
        </Swatch>
        {LEGEND_TEXT.hatch}
      </li>
      <li className="flex items-center gap-2">
        <Swatch width={24}>
          <circle cx={5} cy={7} r={3.5} fill={NOVA_INK.against} />
          <circle cx={17} cy={7} r={6} fill={NOVA_INK.against} />
        </Swatch>
        {LEGEND_TEXT.size}
      </li>
      <li className="flex items-center gap-2">
        <Swatch width={24}>
          <path d="M2,14 L20,0 A22,22 0 0 1 24,13 Z" fill={SECTOR_SWATCH} opacity={0.5} />
        </Swatch>
        {LEGEND_TEXT.width}
      </li>
    </ul>
  );
}
