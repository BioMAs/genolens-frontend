'use client';

import { useState } from 'react';
import { CosmeticEvidencePathway } from '@/hooks/useCosmetics';

interface Props {
  pathways: CosmeticEvidencePathway[];
  claimLabel: string;
  claimColor: string;
  claimScore: number;
  verdictColor?: string;
}

const UP_COLOR = '#ef4444';
const DOWN_COLOR = '#3b82f6';

function dirColor(dir: string) {
  return dir === 'UP' ? UP_COLOR : DOWN_COLOR;
}

// Layout — wide landscape
const VW = 1000;
const VH = 400;           // taller to avoid clipping
const PADDING_TOP = 48;   // minimum Y for first node
const PADDING_BOT = 48;   // minimum margin from bottom
const HUB_X = 130;
const HUB_Y = VH / 2;
const HUB_R = 54;
const PATHWAY_START_X = 300;
const COL_W = 330;
const ROW_H = 72;
const NODE_R = 14;
const LABEL_OFFSET = 24;

interface TooltipState { x: number; y: number; lines: string[] }

export default function ClaimPathwayMap({ pathways, claimLabel, claimColor, claimScore, verdictColor }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (pathways.length === 0) return null;

  // ── Deduplication by pathway_name (keep highest-weight entry) ──────────────
  const nameMap = new Map<string, CosmeticEvidencePathway>();
  for (const pw of pathways) {
    const key = pw.pathway_name.toLowerCase().trim();
    const existing = nameMap.get(key);
    if (!existing || pw.weight > existing.weight) nameMap.set(key, pw);
  }
  const deduped = Array.from(nameMap.values());

  // Sort: UP first, then DOWN; within each group by weight desc
  const sorted = [...deduped].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'UP' ? -1 : 1;
    return b.weight - a.weight;
  });

  const upPathways = sorted.filter((p) => p.direction === 'UP');
  const downPathways = sorted.filter((p) => p.direction === 'DOWN');
  const hasBoth = upPathways.length > 0 && downPathways.length > 0;

  // Position nodes in a vertical column, clamped to avoid clipping
  function colNodes(pws: CosmeticEvidencePathway[], colX: number) {
    if (pws.length === 0) return [];
    const totalH = (pws.length - 1) * ROW_H;
    const availH = VH - PADDING_TOP - PADDING_BOT;
    // If too many nodes, compress ROW_H
    const effectiveRowH = totalH > availH ? availH / (pws.length - 1) : ROW_H;
    const effectiveTotalH = (pws.length - 1) * effectiveRowH;
    const startY = Math.max(PADDING_TOP, VH / 2 - effectiveTotalH / 2);
    return pws.map((pw, i) => ({
      pw,
      x: colX,
      y: startY + i * effectiveRowH,
    }));
  }

  const upNodes = colNodes(upPathways, hasBoth ? PATHWAY_START_X : PATHWAY_START_X + COL_W / 2);
  const downNodes = colNodes(downPathways, hasBoth ? PATHWAY_START_X + COL_W : PATHWAY_START_X + COL_W / 2);
  const allNodes = [...upNodes, ...downNodes];

  const evidenceOpacity: Record<string, number> = { HIGH: 1, MODERATE: 0.72, LOW: 0.45 };

  const hubColor = verdictColor ?? claimColor;

  return (
    <div className="relative mt-3" onMouseLeave={() => setTooltip(null)}>

      {/* Column headers */}
      {hasBoth && (
        <div
          className="mb-1 flex text-xs font-semibold"
          style={{ paddingLeft: `${(PATHWAY_START_X / VW) * 100}%` }}
        >
          <span style={{ width: `${(COL_W / VW) * 100}%`, color: UP_COLOR }}>↑ UP-regulated</span>
          <span style={{ color: DOWN_COLOR }}>↓ DOWN-regulated</span>
        </div>
      )}
      {!hasBoth && upPathways.length > 0 && (
        <div className="mb-1 text-xs font-semibold" style={{ paddingLeft: `${(PATHWAY_START_X / VW) * 100}%`, color: UP_COLOR }}>
          ↑ UP-regulated
        </div>
      )}
      {!hasBoth && downPathways.length > 0 && (
        <div className="mb-1 text-xs font-semibold" style={{ paddingLeft: `${(PATHWAY_START_X / VW) * 100}%`, color: DOWN_COLOR }}>
          ↓ DOWN-regulated
        </div>
      )}

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        aria-label={`Pathway network for ${claimLabel}`}
      >
        {/* Hub → pathway Bézier spokes */}
        {allNodes.map(({ pw, x, y }, i) => {
          const col = dirColor(pw.direction);
          const cx1 = HUB_X + HUB_R + 60;
          const cx2 = x - NODE_R - 50;
          return (
            <path
              key={`spoke-${i}`}
              d={`M${HUB_X + HUB_R},${HUB_Y} C${cx1},${HUB_Y} ${cx2},${y} ${x - NODE_R},${y}`}
              fill="none"
              stroke={col}
              strokeWidth={Math.max(1, pw.weight * 2)}
              strokeOpacity={0.22}
            />
          );
        })}

        {/* Central claim hub */}
        <circle cx={HUB_X} cy={HUB_Y} r={HUB_R} fill={hubColor} fillOpacity={0.12} stroke={hubColor} strokeWidth={2.5} />
        {(() => {
          const words = claimLabel.split(' ');
          const mid = Math.ceil(words.length / 2);
          const line1 = words.slice(0, mid).join(' ');
          const line2 = words.slice(mid).join(' ');
          const hasTwo = line2.length > 0;
          return hasTwo ? (
            <>
              <text x={HUB_X} y={HUB_Y - 14} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={hubColor}>{line1}</text>
              <text x={HUB_X} y={HUB_Y + 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={hubColor}>{line2}</text>
              <text x={HUB_X} y={HUB_Y + 18} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={hubColor} opacity={0.7}>{claimScore}/100</text>
            </>
          ) : (
            <>
              <text x={HUB_X} y={HUB_Y - 7} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="700" fill={hubColor}>{line1}</text>
              <text x={HUB_X} y={HUB_Y + 10} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={hubColor} opacity={0.7}>{claimScore}/100</text>
            </>
          );
        })()}

        {/* Pathway nodes + labels */}
        {allNodes.map(({ pw, x, y }, i) => {
          const col = dirColor(pw.direction);
          const opacity = evidenceOpacity[pw.evidence_level] ?? 0.5;
          const labelX = x + NODE_R + LABEL_OFFSET;
          const maxChars = 40;
          const label = pw.pathway_name.length > maxChars
            ? pw.pathway_name.slice(0, maxChars - 1) + '…'
            : pw.pathway_name;

          return (
            <g
              key={`${pw.term_id}-${i}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
                const svgRect = svgEl?.getBoundingClientRect();
                if (!svgRect) return;
                const scaleX = svgRect.width / VW;
                const scaleY = svgRect.height / VH;
                setTooltip({
                  x: x * scaleX,
                  y: (y - NODE_R - 6) * scaleY,
                  lines: [
                    pw.pathway_name,
                    `Direction: ${pw.direction === 'UP' ? '↑ UP-regulated' : '↓ DOWN-regulated'}`,
                    `Evidence: ${pw.evidence_level}`,
                    `FDR: ${pw.padj.toExponential(2)}`,
                    ...(pw.category ? [`Category: ${pw.category}`] : []),
                  ],
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Outer glow ring */}
              <circle cx={x} cy={y} r={NODE_R + 4} fill={col} fillOpacity={0.1} />
              {/* Main node */}
              <circle cx={x} cy={y} r={NODE_R} fill={col} fillOpacity={opacity} stroke="#fff" strokeWidth={2} />
              {/* Arrow inside */}
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#fff" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {pw.direction === 'UP' ? '↑' : '↓'}
              </text>
              {/* Pathway name */}
              <text x={labelX} y={y - 6} textAnchor="start" dominantBaseline="middle" fontSize={12} fontWeight="500" fill="var(--text-primary)" style={{ pointerEvents: 'none' }}>
                {label}
              </text>
              {/* Sub-label */}
              <text x={labelX} y={y + 10} textAnchor="start" dominantBaseline="middle" fontSize={10} fill="var(--text-secondary)" style={{ pointerEvents: 'none' }}>
                {pw.evidence_level} · FDR {pw.padj.toExponential(1)}{pw.category ? ` · ${pw.category}` : ''}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g>
          <circle cx={VW - 170} cy={VH - 14} r={5} fill={UP_COLOR} />
          <text x={VW - 161} y={VH - 10} fontSize={10} fill="#6b7280">UP-regulated</text>
          <circle cx={VW - 80} cy={VH - 14} r={5} fill={DOWN_COLOR} />
          <text x={VW - 71} y={VH - 10} fontSize={10} fill="#6b7280">DOWN-regulated</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg px-3 py-2.5 text-xs shadow-xl"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-default)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            maxWidth: 280,
            lineHeight: 1.7,
          }}
        >
          {tooltip.lines.map((line, i) => (
            <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
