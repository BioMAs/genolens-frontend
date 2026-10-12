'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import { cn } from '@/lib/cn';
import {
  NOVA,
  arcPath,
  formatP,
  layoutNova,
  pathwaysFor,
  wedgePath,
  type NovaBand,
  type NovaBubble,
  type NovaLayout,
} from './novaLayout';
import { NOVA_INK } from './novaPalette';

/** Same stack as the reference figure: the label widths are estimated for it. */
export const NOVA_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

const HALO = { paintOrder: 'stroke', stroke: NOVA_INK.background, strokeWidth: 4, strokeLinejoin: 'round' } as const;

function sectorLabel(band: NovaBand): string {
  if (band.kind === 'other') return `${band.name}: significant pathways attached to no claim`;
  const claim = band.claim!;
  return `${claim.name}: ${pathwaysFor(claim).replace(' · ', ', ')}, coherence ${Math.round(100 * claim.coherence)}%`;
}

function bubbleLabel(bubble: NovaBubble): string {
  const sub = bubble.subgroup;
  const owner = bubble.claimName ?? 'not linked to a claim';
  const stance = bubble.claimName ? (sub.delta > 0 ? 'supports' : 'contradicts') : 'pathway';
  return `${sub.name}, ${formatP(sub.nl)}, ${stance} — ${owner}`;
}

export function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width={7} height={7} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width={7} height={7} fill={NOVA_INK.hatchFill} />
      <line x1={0} y1={0} x2={0} y2={7} stroke={NOVA_INK.hatchLine} strokeWidth={2.2} />
    </pattern>
  );
}

interface GraphicProps {
  layout: NovaLayout;
  hatchId: string;
  selectedClaim?: string | null;
  onSelectBand?: (band: NovaBand) => void;
  onHoverBubble?: (bubble: NovaBubble | null) => void;
}

/**
 * The nova itself, as SVG children in the reference frame (centre 500,555).
 * Drawn in the reference order: sectors, dust, rings, terms, bubbles, rims,
 * core, claim labels. No halo, no glow, no line to the centre, no pathway name.
 */
export function NovaGraphic({ layout, hatchId, selectedClaim, onSelectBand, onHoverBubble }: GraphicProps) {
  const interactive = !!onSelectBand;
  const { R, cx, cy } = NOVA;

  const keyHandler = (band: NovaBand) => (event: KeyboardEvent<SVGGElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectBand?.(band);
    }
  };

  return (
    <g fontFamily={NOVA_FONT}>
      {layout.bands.map((band) => {
        const selected = band.kind === 'claim' && band.name === selectedClaim;
        const shapes =
          band.kind === 'claim' ? (
            <>
              <path d={wedgePath(band.start, band.split, R)} fill={band.color.fill} opacity={0.14} />
              {band.end > band.split && (
                <path d={wedgePath(band.split, band.end, R)} fill={`url(#${hatchId})`} opacity={0.9} />
              )}
            </>
          ) : (
            <path d={wedgePath(band.start, band.end, R)} fill={NOVA_INK.against} opacity={0.07} />
          );
        if (!interactive) return <g key={band.key}>{shapes}</g>;
        return (
          <g
            key={band.key}
            role="button"
            tabIndex={0}
            aria-label={sectorLabel(band)}
            aria-pressed={band.kind === 'claim' ? selected : undefined}
            data-band={band.key}
            className="cursor-pointer outline-none focus-visible:[&>path]:opacity-40"
            onClick={() => onSelectBand?.(band)}
            onKeyDown={keyHandler(band)}
          >
            {shapes}
          </g>
        );
      })}

      <g pointerEvents="none">
        {layout.dust.map((layer, i) => (
          <path key={i} d={layer.d} fill={layer.fill} opacity={layer.opacity} />
        ))}
        {layout.rings.map((ring) => (
          <circle
            key={ring.key}
            cx={cx}
            cy={cy}
            r={ring.r}
            fill="none"
            stroke={NOVA_INK.ink}
            strokeWidth={ring.kind === 'threshold' ? 0.9 : 0.5}
            strokeDasharray={ring.kind === 'threshold' ? '3 5' : '1 4'}
            opacity={ring.kind === 'threshold' ? 0.6 : 0.45}
          />
        ))}
        {layout.rings.map((ring) => (
          <text
            key={`${ring.key}-label`}
            x={ring.labelX}
            y={ring.labelY}
            fontSize={10.5}
            fill={NOVA_INK.ink}
            textAnchor="middle"
            {...HALO}
          >
            {ring.kind === 'threshold' ? (
              ring.label
            ) : (
              <>
                {ring.label}
                <tspan dy={-5} fontSize={8}>
                  −{ring.exponent}
                </tspan>
              </>
            )}
          </text>
        ))}
        {layout.bubbles.flatMap((bubble) =>
          bubble.terms.map((dot) => (
            <circle key={dot.key} cx={dot.x} cy={dot.y} r={dot.r} fill={dot.fill} opacity={dot.opacity} />
          )),
        )}
      </g>

      {layout.bubbles.map((bubble) => (
        <circle
          key={bubble.key}
          cx={bubble.x}
          cy={bubble.y}
          r={bubble.r}
          fill={bubble.fill}
          opacity={0.95}
          stroke={NOVA_INK.background}
          strokeWidth={1.5}
          role="img"
          aria-label={bubbleLabel(bubble)}
          data-subgroup={bubble.subgroup.name}
          className={interactive ? 'cursor-pointer' : undefined}
          onMouseEnter={onHoverBubble ? () => onHoverBubble(bubble) : undefined}
          onMouseLeave={onHoverBubble ? () => onHoverBubble(null) : undefined}
          onClick={
            interactive && bubble.claimName
              ? () => onSelectBand?.(layout.bands.find((b) => b.key === bubble.bandKey)!)
              : undefined
          }
        />
      ))}

      <g pointerEvents="none">
        {layout.bands.map((band) =>
          band.kind === 'claim' ? (
            <g key={`${band.key}-rim`}>
              <path
                d={arcPath(band.start, band.split, R)}
                fill="none"
                stroke={band.color.fill}
                strokeWidth={band.name === selectedClaim ? 8 : 4}
              />
              {band.end > band.split && (
                <path
                  d={arcPath(band.split, band.end, R)}
                  fill="none"
                  stroke={NOVA_INK.against}
                  strokeWidth={band.name === selectedClaim ? 8 : 4}
                />
              )}
            </g>
          ) : (
            <path
              key={`${band.key}-rim`}
              d={arcPath(band.start, band.end, R)}
              fill="none"
              stroke={NOVA_INK.against}
              strokeWidth={2}
              strokeDasharray="2 4"
            />
          ),
        )}
        <circle cx={cx} cy={cy} r={NOVA.coreRadius} fill={NOVA_INK.core} />
        <text x={cx} y={cy + 5} fontSize={13} fill={NOVA_INK.background} textAnchor="middle" fontWeight={600}>
          {layout.condition}
        </text>
      </g>

      {layout.labels.map((label) => {
        const band = layout.bands.find((b) => b.key === label.bandKey)!;
        return (
          <g
            key={`${label.bandKey}-label`}
            data-claim-label={band.name}
            className={interactive && band.kind === 'claim' ? 'cursor-pointer' : undefined}
            onClick={interactive && band.kind === 'claim' ? () => onSelectBand?.(band) : undefined}
            aria-hidden
          >
            {label.lines.map((line, i) => (
              <text
                key={i}
                x={line.x}
                y={line.y}
                fontSize={line.size}
                fill={line.fill}
                textAnchor={label.anchor}
                fontWeight={line.weight}
                {...HALO}
              >
                {line.text}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function BubbleTooltip({ bubble, layout }: { bubble: NovaBubble; layout: NovaLayout }) {
  const { bounds } = layout;
  const left = ((bubble.x - bounds.x) / bounds.width) * 100;
  const top = ((bubble.y - bounds.y) / bounds.height) * 100;
  const sub = bubble.subgroup;
  const flip = left > 55;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 w-72 max-w-[80vw] rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] p-3 text-left text-[12px] leading-snug text-[var(--nova-ink)] shadow-lg"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(${flip ? 'calc(-100% - 14px)' : '14px'}, -50%)`,
      }}
    >
      <p className="text-[13px] font-semibold text-[var(--nova-ink-strong)]">{sub.name}</p>
      <p className="mt-1 text-[var(--nova-ink-muted)]">
        {formatP(sub.nl)}
        {bubble.claimName && (
          <>
            {' · '}S<sub>pro</sub> {sub.s_pro.toFixed(1)} · S<sub>anti</sub> {sub.s_anti.toFixed(1)}
          </>
        )}
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-hidden">
        {sub.terms.map((term, i) => (
          <li key={`${term.id}-${term.obs}-${i}`} className="flex gap-2">
            <span
              className="font-semibold"
              style={{
                color: term.effect > 0 ? NOVA_INK.green : term.effect < 0 ? NOVA_INK.coral : NOVA_INK.againstText,
              }}
            >
              {term.obs === 'up' ? '↑' : '↓'}
            </span>
            <span className="min-w-0">
              <span className="text-[var(--nova-ink-subtle)]">{term.id}</span> {term.label}
              <span className="whitespace-nowrap text-[var(--nova-ink-subtle)]">
                {' · '}
                {formatP(term.nl)}
                {term.effect !== 0 && ` · ${term.effect > 0 ? 'pro' : 'anti'}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface CosmOmicsNovaProps {
  data: CosmOmicsNovaData;
  /** Seed of the decorative jitter: the dataset id (plus comparison). */
  seed: string;
  showDust?: boolean;
  selectedClaim?: string | null;
  onSelectClaim?: (name: string) => void;
  className?: string;
}

/** Interactive nova: hover a bubble for its terms, click a sector for its claim card. */
export default function CosmOmicsNova({
  data,
  seed,
  showDust = true,
  selectedClaim = null,
  onSelectClaim,
  className,
}: CosmOmicsNovaProps) {
  const layout = useMemo(() => layoutNova(data, { seed, showDust }), [data, seed, showDust]);
  const hatchId = `nova-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [hovered, setHovered] = useState<NovaBubble | null>(null);
  const { bounds } = layout;

  return (
    <div className={cn('relative', className)} data-cosmomics-nova>
      <svg
        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
        width="100%"
        role="group"
        aria-label={`CosmOmics pathway nova — ${data.contrast}: ${data.claims.length} claims`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <HatchPattern id={hatchId} />
        </defs>
        <NovaGraphic
          layout={layout}
          hatchId={hatchId}
          selectedClaim={selectedClaim}
          onSelectBand={(band) => band.kind === 'claim' && onSelectClaim?.(band.name)}
          onHoverBubble={setHovered}
        />
      </svg>
      {hovered && <BubbleTooltip bubble={hovered} layout={layout} />}
    </div>
  );
}
