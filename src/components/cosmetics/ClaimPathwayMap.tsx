'use client';

import { useState } from 'react';
import { CosmeticEvidencePathway } from '@/hooks/useCosmetics';

interface Props {
  pathways: CosmeticEvidencePathway[];
  claimLabel: string;
  claimColor: string;
  claimScore: number;
}

const UP_COLOR = '#ef4444';
const DOWN_COLOR = '#3b82f6';
const EVIDENCE_R: Record<string, number> = { HIGH: 13, MODERATE: 10, LOW: 8 };
const EVIDENCE_OPACITY: Record<string, number> = { HIGH: 1, MODERATE: 0.75, LOW: 0.5 };

const CX = 190;
const CY = 145;
const ORBIT_R = 105;
const VW = 420;
const VH = 300;

function dirColor(dir: string) {
  return dir === 'UP' ? UP_COLOR : DOWN_COLOR;
}

function labelAnchor(x: number): 'start' | 'middle' | 'end' {
  if (x < CX - 20) return 'end';
  if (x > CX + 20) return 'start';
  return 'middle';
}

function labelDy(y: number): string {
  if (y < CY - 20) return '-0.5em';
  if (y > CY + 20) return '1.1em';
  return '0.35em';
}

interface TooltipState { x: number; y: number; lines: string[] }

export default function ClaimPathwayMap({ pathways, claimLabel, claimColor, claimScore }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (pathways.length === 0) return null;

  // Sort by category so same-category pathways are adjacent in the circle
  const sorted = [...pathways].sort((a, b) =>
    (a.category ?? '').localeCompare(b.category ?? '') || b.weight - a.weight
  );

  const n = sorted.length;

  // Compute node positions (evenly spaced on the orbit circle)
  const nodes = sorted.map((p, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      pw: p,
      x: CX + ORBIT_R * Math.cos(angle),
      y: CY + ORBIT_R * Math.sin(angle),
      r: EVIDENCE_R[p.evidence_level] ?? 9,
    };
  });

  // Same-category edges (connect adjacent pairs in the sorted order)
  const edges: { i: number; j: number }[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (sorted[i].category && sorted[i].category === sorted[i + 1].category) {
      edges.push({ i, j: i + 1 });
    }
  }

  // Label position: pushed further out from the circle center
  const LABEL_R = ORBIT_R + 22;
  const labels = sorted.map((p, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      x: CX + LABEL_R * Math.cos(angle),
      y: CY + LABEL_R * Math.sin(angle),
      text: p.pathway_name.length > 28 ? p.pathway_name.slice(0, 27) + '…' : p.pathway_name,
    };
  });

  return (
    <div className="relative mt-2" onMouseLeave={() => setTooltip(null)}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        aria-label={`Pathway network for ${claimLabel}`}
      >
        {/* Same-category connection arcs */}
        {edges.map(({ i, j }) => (
          <line
            key={`${i}-${j}`}
            x1={nodes[i].x}
            y1={nodes[i].y}
            x2={nodes[j].x}
            y2={nodes[j].y}
            stroke="#cbd5e1"
            strokeWidth={1.5}
            strokeDasharray="3 2"
            opacity={0.7}
          />
        ))}

        {/* Spokes from center to each node */}
        {nodes.map(({ pw, x, y }, i) => (
          <line
            key={`spoke-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke={dirColor(pw.direction)}
            strokeWidth={Math.max(0.6, pw.weight * 1.6)}
            strokeOpacity={0.22}
          />
        ))}

        {/* Central claim hub */}
        <circle cx={CX} cy={CY} r={36} fill={claimColor} fillOpacity={0.12} stroke={claimColor} strokeWidth={2} />
        <text x={CX} y={CY - 5} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="700" fill={claimColor}>
          {claimLabel.length > 16 ? claimLabel.slice(0, 15) + '…' : claimLabel}
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={claimColor} opacity={0.75}>
          {claimScore}/100
        </text>

        {/* Pathway nodes + labels */}
        {nodes.map(({ pw, x, y, r }, i) => {
          const lab = labels[i];
          const anchor = labelAnchor(lab.x);
          const dy = labelDy(lab.y);
          return (
            <g
              key={pw.term_id}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                const svgEl = e.currentTarget.closest('svg') as SVGSVGElement;
                const svgRect = svgEl?.getBoundingClientRect();
                if (!svgRect) return;
                // Scale tooltip coords from SVG viewBox to rendered px
                const scaleX = svgRect.width / VW;
                const scaleY = svgRect.height / VH;
                setTooltip({
                  x: x * scaleX,
                  y: (y - r - 4) * scaleY,
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
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={dirColor(pw.direction)}
                fillOpacity={EVIDENCE_OPACITY[pw.evidence_level] ?? 0.5}
                stroke="#fff"
                strokeWidth={1.5}
              />
              <text
                x={lab.x}
                y={lab.y}
                textAnchor={anchor}
                dy={dy}
                fontSize={8}
                fill="var(--text-secondary)"
                style={{ pointerEvents: 'none' }}
              >
                {lab.text}
              </text>
            </g>
          );
        })}

        {/* Direction mini-legend */}
        <g transform={`translate(${VW - 8}, ${VH - 8})`}>
          <circle cx={-70} cy={-8} r={4} fill={UP_COLOR} />
          <text x={-63} y={-5} fontSize={7} fill="#6b7280">UP</text>
          <circle cx={-40} cy={-8} r={4} fill={DOWN_COLOR} />
          <text x={-33} y={-5} fontSize={7} fill="#6b7280">DOWN</text>
          <line x1={-85} y1={-4} x2={-80} y2={-4} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 1" />
          <text x={-77} y={-1} fontSize={6.5} fill="#9ca3af">same category</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg px-3 py-2 text-xs shadow-xl"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--surface-default)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            maxWidth: 240,
            lineHeight: 1.6,
            whiteSpace: 'normal',
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
