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

function dirColor(dir: string) {
  return dir === 'UP' ? UP_COLOR : DOWN_COLOR;
}

// Layout constants — wide landscape SVG
const VW = 1000;
const VH = 340;
const HUB_X = 130;
const HUB_Y = VH / 2;
const HUB_R = 54;
const PATHWAY_START_X = 300;
const COL_W = 320;        // width of each pathway column
const ROW_H = 68;         // vertical spacing between pathway rows
const NODE_R = 14;
const LABEL_OFFSET = 22;  // gap between node edge and label text

interface TooltipState { x: number; y: number; lines: string[] }

export default function ClaimPathwayMap({ pathways, claimLabel, claimColor, claimScore }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (pathways.length === 0) return null;

  // Sort: UP first, then DOWN; within each group by weight desc
  const sorted = [...pathways].sort((a, b) => {
    if (a.direction !== b.direction) return a.direction === 'UP' ? -1 : 1;
    return b.weight - a.weight;
  });

  // Lay pathways in 2 columns: left column = UP, right column = DOWN
  const upPathways = sorted.filter((p) => p.direction === 'UP');
  const downPathways = sorted.filter((p) => p.direction === 'DOWN');

  // Each column is a vertical list, centered in VH
  function colNodes(pws: CosmeticEvidencePathway[], colX: number) {
    const totalH = (pws.length - 1) * ROW_H;
    const startY = VH / 2 - totalH / 2;
    return pws.map((pw, i) => ({
      pw,
      x: colX,
      y: startY + i * ROW_H,
    }));
  }

  // If only one direction present, use a single centred column; otherwise two columns
  const hasBoth = upPathways.length > 0 && downPathways.length > 0;
  const upNodes = colNodes(upPathways, hasBoth ? PATHWAY_START_X : PATHWAY_START_X + COL_W / 2);
  const downNodes = colNodes(downPathways, hasBoth ? PATHWAY_START_X + COL_W : PATHWAY_START_X + COL_W / 2);
  const allNodes = [...upNodes, ...downNodes];

  // Same-category connections (thin dashed line between nodes of same category)
  const catGroups = new Map<string, typeof allNodes>();
  for (const node of allNodes) {
    const cat = node.pw.category ?? '';
    if (!cat) continue;
    if (!catGroups.has(cat)) catGroups.set(cat, []);
    catGroups.get(cat)!.push(node);
  }
  const catEdges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const members of catGroups.values()) {
    for (let i = 0; i < members.length - 1; i++) {
      catEdges.push({ x1: members[i].x, y1: members[i].y, x2: members[i + 1].x, y2: members[i + 1].y });
    }
  }

  // Evidence level → node opacity
  const evidenceOpacity: Record<string, number> = { HIGH: 1, MODERATE: 0.72, LOW: 0.45 };

  return (
    <div className="relative mt-3" onMouseLeave={() => setTooltip(null)}>
      {/* Direction column headers */}
      {hasBoth && (
        <div className="mb-1 flex text-xs font-semibold" style={{ paddingLeft: `${(PATHWAY_START_X / VW) * 100}%` }}>
          <span style={{ width: `${(COL_W / VW) * 100}%`, color: UP_COLOR }}>↑ UP-regulated</span>
          <span style={{ color: DOWN_COLOR }}>↓ DOWN-regulated</span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', width: '100%', height: 'auto' }}
        aria-label={`Pathway network for ${claimLabel}`}
      >
        {/* Same-category dashed connectors */}
        {catEdges.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#cbd5e1" strokeWidth={1.8} strokeDasharray="4 3" opacity={0.75}
          />
        ))}

        {/* Hub → pathway spokes */}
        {allNodes.map(({ pw, x, y }, i) => {
          const col = dirColor(pw.direction);
          // Bezier: exit hub on the right, arrive at node on the left
          const cx1 = HUB_X + HUB_R + 60;
          const cx2 = x - NODE_R - 50;
          return (
            <path
              key={`spoke-${i}`}
              d={`M${HUB_X + HUB_R},${HUB_Y} C${cx1},${HUB_Y} ${cx2},${y} ${x - NODE_R},${y}`}
              fill="none"
              stroke={col}
              strokeWidth={Math.max(1, pw.weight * 2)}
              strokeOpacity={0.25}
            />
          );
        })}

        {/* Central claim hub */}
        <circle cx={HUB_X} cy={HUB_Y} r={HUB_R} fill={claimColor} fillOpacity={0.13} stroke={claimColor} strokeWidth={2.5} />
        {/* Claim label — split into two lines if long */}
        {claimLabel.length <= 12 ? (
          <>
            <text x={HUB_X} y={HUB_Y - 8} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight="700" fill={claimColor}>
              {claimLabel}
            </text>
            <text x={HUB_X} y={HUB_Y + 12} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill={claimColor} opacity={0.75}>
              {claimScore}/100
            </text>
          </>
        ) : (
          <>
            <text x={HUB_X} y={HUB_Y - 14} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={claimColor}>
              {claimLabel.split(' ').slice(0, Math.ceil(claimLabel.split(' ').length / 2)).join(' ')}
            </text>
            <text x={HUB_X} y={HUB_Y + 2} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={claimColor}>
              {claimLabel.split(' ').slice(Math.ceil(claimLabel.split(' ').length / 2)).join(' ')}
            </text>
            <text x={HUB_X} y={HUB_Y + 18} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill={claimColor} opacity={0.75}>
              {claimScore}/100
            </text>
          </>
        )}

        {/* Pathway nodes + labels */}
        {allNodes.map(({ pw, x, y }, i) => {
          const col = dirColor(pw.direction);
          const opacity = evidenceOpacity[pw.evidence_level] ?? 0.5;
          // Label to the right of the node
          const labelX = x + NODE_R + LABEL_OFFSET;
          const maxChars = 42;
          const label = pw.pathway_name.length > maxChars
            ? pw.pathway_name.slice(0, maxChars - 1) + '…'
            : pw.pathway_name;
          return (
            <g
              key={pw.term_id}
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
              {/* Evidence level ring */}
              <circle cx={x} cy={y} r={NODE_R + 4} fill={col} fillOpacity={0.1} />
              <circle
                cx={x} cy={y} r={NODE_R}
                fill={col} fillOpacity={opacity}
                stroke="#fff" strokeWidth={2}
              />
              {/* Direction arrow inside node */}
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#fff" fontWeight="700" style={{ pointerEvents: 'none' }}>
                {pw.direction === 'UP' ? '↑' : '↓'}
              </text>
              {/* Pathway label */}
              <text
                x={labelX} y={y - 5}
                textAnchor="start" dominantBaseline="middle"
                fontSize={12} fontWeight="500"
                fill="var(--text-primary)"
                style={{ pointerEvents: 'none' }}
              >
                {label}
              </text>
              {/* Sub-label: evidence + FDR */}
              <text
                x={labelX} y={y + 11}
                textAnchor="start" dominantBaseline="middle"
                fontSize={10}
                fill="var(--text-secondary)"
                style={{ pointerEvents: 'none' }}
              >
                {pw.evidence_level} · FDR {pw.padj.toExponential(1)}
                {pw.category ? ` · ${pw.category}` : ''}
              </text>
            </g>
          );
        })}

        {/* Legend bottom-right */}
        <g transform={`translate(${VW - 10}, ${VH - 10})`}>
          <circle cx={-160} cy={-10} r={6} fill={UP_COLOR} />
          <text x={-150} y={-6} fontSize={10} fill="#6b7280">UP-regulated</text>
          <circle cx={-60} cy={-10} r={6} fill={DOWN_COLOR} />
          <text x={-50} y={-6} fontSize={10} fill="#6b7280">DOWN-regulated</text>
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
