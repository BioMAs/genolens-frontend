import { NOVA_FONT, HatchPattern } from './CosmOmicsNova';
import { NOVA_INK, claimColor } from './novaPalette';
import { NOT_EVALUATED_TEXT, STILL_COUNTED_TEXT } from './novaText';

/** The legend entries: the reference figure's five, then what the honest nova adds. */
export const LEGEND_TEXT = {
  subgroup: 'Sub-group: terms for → against the claim',
  term: 'Individual ontology term',
  hatch: 'Evidence against the claim (hatched)',
  size: 'Size = |Δ pro − anti|',
  width: 'Sector width = claim importance (Σ −log10 adj. p of its terms)',
  balanced: 'Balanced: evidence for and against cancels (Δ = 0), counted neither for nor against',
  faded: 'Faded dot: term not significant at α',
  coherence:
    'Coherence = S pro / (S pro + S anti): the share of the evidence weight that goes for the claim, not a probability',
  notEvaluated: NOT_EVALUATED_TEXT,
  stillCounted: STILL_COUNTED_TEXT,
} as const;

/** Lines of the exported legend that say what a number means rather than what a mark is. */
export const LEGEND_NOTES = [LEGEND_TEXT.coherence, LEGEND_TEXT.notEvaluated, LEGEND_TEXT.stillCounted] as const;

const SECTOR_SWATCH = claimColor('Firming').fill;

const ROW = 22;
const NOTE = 16;

/** Height of the exported legend: three rows of marks, then `noteLines` lines of notes. */
export function legendHeight(noteLines: number): number {
  return 2 * ROW + 28 + noteLines * NOTE;
}

/**
 * Reference legend as SVG, for the exported figure (reference `legend(y)`), with its
 * added entries and one line per note: what the numbers mean, what is not drawn, what
 * the nova was computed from. `notes` are already wrapped to the width of the figure.
 */
export function NovaLegendSvg({ y, hatchId, notes }: { y: number; hatchId: string; notes: string[] }) {
  const y2 = y + ROW;
  const y3 = y + 2 * ROW;
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
      <circle cx={56} cy={y3 - 5} r={3.5} fill={NOVA_INK.neutral} />
      {text(70, y3, LEGEND_TEXT.balanced)}
      <circle cx={662} cy={y3 - 5} r={3} fill={NOVA_INK.green} opacity={0.4} />
      {text(674, y3, LEGEND_TEXT.faded)}
      {notes.map((line, i) => (
        <text
          key={i}
          data-note
          x={50}
          y={y3 + 28 + i * NOTE}
          fontSize={12}
          fill={NOVA_INK.againstText}
        >
          {line}
        </text>
      ))}
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
      className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-[var(--nova-ink)]"
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
      <li className="flex items-center gap-2">
        <Swatch width={12}>
          <circle cx={6} cy={7} r={3.5} fill={NOVA_INK.neutral} />
        </Swatch>
        {LEGEND_TEXT.balanced}
      </li>
      <li className="flex items-center gap-2">
        <Swatch width={12}>
          <circle cx={6} cy={7} r={3} fill={NOVA_INK.green} opacity={0.4} />
        </Swatch>
        {LEGEND_TEXT.faded}
      </li>
      <li className="basis-full">{LEGEND_TEXT.coherence}</li>
      <li className="basis-full">{LEGEND_TEXT.notEvaluated}</li>
      <li className="basis-full">{LEGEND_TEXT.stillCounted}</li>
    </ul>
  );
}
