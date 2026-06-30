'use client';

import { useState, useMemo } from 'react';
import { CosmeticClaimScore, CosmeticEvidencePathway } from '@/hooks/useCosmetics';

interface Props {
  claims: CosmeticClaimScore[];
}

const UP_COLOR = '#ef4444';
const DOWN_COLOR = '#3b82f6';
const W = 860;
const H = 520;
const CLAIM_X = 620;
const PATHWAY_X = 200;
const CLAIM_R_MIN = 32;
const CLAIM_R_MAX = 50;
const PATHWAY_R = 8;
const EVIDENCE_OPACITY: Record<string, number> = { HIGH: 1, MODERATE: 0.7, LOW: 0.42 };

function claimRadius(score: number) {
  return CLAIM_R_MIN + (score / 100) * (CLAIM_R_MAX - CLAIM_R_MIN);
}
function dirColor(dir: string) {
  return dir === 'UP' ? UP_COLOR : DOWN_COLOR;
}

interface PathwayEntry {
  id: string;
  name: string;
  direction: string;
  evidence_level: string;
  padj: number;
  weight: number;
  claimSlugs: string[];
}

interface TooltipState {
  x: number;
  y: number;
  lines: string[];
}

export default function ClaimPathwayNetwork({ claims }: Props) {
  const [filterDir, setFilterDir] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Active claims (those with any signal)
  const activeClaims = useMemo(
    () => claims.filter((c) => c.n_supporting > 0 || c.n_contradicting > 0),
    [claims]
  );

  // Deduplicate pathways, build index
  const { pathways, links } = useMemo(() => {
    const pwMap = new Map<string, PathwayEntry>();
    const linkList: { pwId: string; claimSlug: string; direction: string; weight: number }[] = [];

    for (const claim of activeClaims) {
      for (const ep of claim.evidence_pathways) {
        if (filterDir !== 'ALL' && ep.direction !== filterDir) continue;
        const existing = pwMap.get(ep.term_id);
        if (existing) {
          if (!existing.claimSlugs.includes(claim.slug)) existing.claimSlugs.push(claim.slug);
        } else {
          pwMap.set(ep.term_id, {
            id: ep.term_id,
            name: ep.pathway_name,
            direction: ep.direction,
            evidence_level: ep.evidence_level,
            padj: ep.padj,
            weight: ep.weight,
            claimSlugs: [claim.slug],
          });
        }
        linkList.push({ pwId: ep.term_id, claimSlug: claim.slug, direction: ep.direction, weight: ep.weight });
      }
    }

    // Sort pathways: UP first, then DOWN; within each group by weight desc
    const sorted = Array.from(pwMap.values()).sort((a, b) => {
      if (a.direction !== b.direction) return a.direction === 'UP' ? -1 : 1;
      return b.weight - a.weight;
    });

    return { pathways: sorted, links: linkList };
  }, [activeClaims, filterDir]);

  // Vertical positions
  const claimY = (i: number) => {
    const step = H / (activeClaims.length + 1);
    return step * (i + 1);
  };
  const pathwayY = (i: number) => {
    const step = H / (pathways.length + 1);
    return step * (i + 1);
  };

  const claimSlugToIndex = useMemo(
    () => new Map(activeClaims.map((c, i) => [c.slug, i])),
    [activeClaims]
  );
  const pathwayIdToIndex = useMemo(
    () => new Map(pathways.map((p, i) => [p.id, i])),
    [pathways]
  );

  const isDimmed = (slug: string | null | undefined, kind: 'claim' | 'pathway') => {
    if (!selectedClaim) return false;
    if (kind === 'claim') return slug !== selectedClaim;
    // dim pathway if not connected to selected claim
    const pw = pathways[pathwayIdToIndex.get(slug ?? '') ?? -1];
    return pw ? !pw.claimSlugs.includes(selectedClaim) : true;
  };

  const isLinkDimmed = (link: typeof links[0]) => {
    if (!selectedClaim) return false;
    return link.claimSlug !== selectedClaim;
  };

  const hasData = pathways.length > 0;

  return (
    <div className="gl-card p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Réseau Pathway → Claim
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Pathways d'évidence connectés aux claims qu'ils soutiennent. Cliquez sur un claim pour isoler.
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'UP', 'DOWN'] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setFilterDir(d); setSelectedClaim(null); }}
              className="rounded px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: filterDir === d
                  ? d === 'UP' ? UP_COLOR : d === 'DOWN' ? DOWN_COLOR : '#374151'
                  : 'var(--surface-elevated)',
                color: filterDir === d ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
              }}
            >
              {d === 'ALL' ? 'Tous' : d === 'UP' ? '↑ UP' : '↓ DOWN'}
            </button>
          ))}
          {selectedClaim && (
            <button
              onClick={() => setSelectedClaim(null)}
              className="rounded px-3 py-1 text-xs font-medium"
              style={{ background: 'var(--surface-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
            >
              ✕ Réinitialiser
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: UP_COLOR }} />
          UP-régulé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: DOWN_COLOR }} />
          DOWN-régulé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded-full border-2" style={{ borderColor: '#6b7280' }} />
          Claim (taille ∝ score)
        </span>
        <span className="ml-auto text-[10px] opacity-60">{pathways.length} pathways · {activeClaims.length} claims</span>
      </div>

      {/* SVG area */}
      <div
        className="relative rounded-lg overflow-hidden select-none"
        style={{ background: 'var(--surface-elevated)' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {!hasData ? (
          <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Aucun pathway d'évidence disponible{filterDir !== 'ALL' ? ` pour la direction ${filterDir}` : ''}.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ display: 'block', width: '100%', height: 'auto', minHeight: 360 }}
            aria-label="Réseau pathway-claim"
          >
            <defs>
              {['UP', 'DOWN'].map((dir) => (
                <marker
                  key={dir}
                  id={`arrow-${dir}`}
                  viewBox="0 -4 8 8"
                  refX="8"
                  refY="0"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto"
                >
                  <path d="M0,-4L8,0L0,4" fill={dirColor(dir)} opacity={0.7} />
                </marker>
              ))}
            </defs>

            {/* Column labels */}
            <text x={PATHWAY_X} y={22} textAnchor="middle" fontSize={10} fill="var(--text-secondary)" opacity={0.6}>
              Pathways
            </text>
            <text x={CLAIM_X} y={22} textAnchor="middle" fontSize={10} fill="var(--text-secondary)" opacity={0.6}>
              Claims
            </text>

            {/* Links */}
            <g>
              {links.map((link, i) => {
                const pwIdx = pathwayIdToIndex.get(link.pwId);
                const clIdx = claimSlugToIndex.get(link.claimSlug);
                if (pwIdx === undefined || clIdx === undefined) return null;
                const x1 = PATHWAY_X + PATHWAY_R;
                const y1 = pathwayY(pwIdx);
                const x2 = CLAIM_X - claimRadius(activeClaims[clIdx].score);
                const y2 = claimY(clIdx);
                const dimmed = isLinkDimmed(link);
                // Bezier curve through midpoint
                const cx = (x1 + x2) / 2;
                return (
                  <path
                    key={i}
                    d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`}
                    fill="none"
                    stroke={dirColor(link.direction)}
                    strokeWidth={Math.max(0.6, link.weight * 2.2)}
                    strokeOpacity={dimmed ? 0.05 : 0.38}
                    markerEnd={`url(#arrow-${link.direction})`}
                  />
                );
              })}
            </g>

            {/* Pathway nodes */}
            <g>
              {pathways.map((pw, i) => {
                const cx = PATHWAY_X;
                const cy = pathwayY(i);
                const opacity = isDimmed(pw.id, 'pathway') ? 0.1 : (EVIDENCE_OPACITY[pw.evidence_level] ?? 0.5);
                return (
                  <g
                    key={pw.id}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                      const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
                      if (!svgRect) return;
                      setTooltip({
                        x: rect.left - svgRect.left + rect.width / 2,
                        y: rect.top - svgRect.top - 8,
                        lines: [
                          pw.name,
                          `Direction : ${pw.direction === 'UP' ? '↑ UP' : '↓ DOWN'}`,
                          `Évidence : ${pw.evidence_level}`,
                          `FDR : ${pw.padj.toExponential(2)}`,
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={PATHWAY_R}
                      fill={dirColor(pw.direction)}
                      fillOpacity={opacity}
                      stroke="#fff"
                      strokeWidth={1.2}
                    />
                    {/* Short label truncated */}
                    <text
                      x={cx - PATHWAY_R - 5}
                      y={cy}
                      textAnchor="end"
                      dominantBaseline="middle"
                      fontSize={9}
                      fill="var(--text-secondary)"
                      opacity={opacity * 0.85}
                    >
                      {pw.name.length > 32 ? pw.name.slice(0, 31) + '…' : pw.name}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Claim nodes */}
            <g>
              {activeClaims.map((claim, i) => {
                const cx = CLAIM_X;
                const cy = claimY(i);
                const r = claimRadius(claim.score);
                const dimmed = isDimmed(claim.slug, 'claim');
                return (
                  <g
                    key={claim.slug}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedClaim((prev) => (prev === claim.slug ? null : claim.slug))}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget as SVGGElement).getBoundingClientRect();
                      const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
                      if (!svgRect) return;
                      setTooltip({
                        x: rect.left - svgRect.left + rect.width / 2,
                        y: rect.top - svgRect.top - 8,
                        lines: [
                          claim.label,
                          `Score : ${claim.score.toFixed(0)}/100`,
                          `✓ ${claim.n_supporting} soutenant  ✗ ${claim.n_contradicting} contradictoire`,
                        ],
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={claim.color}
                      fillOpacity={dimmed ? 0.05 : 0.15}
                      stroke={claim.color}
                      strokeWidth={2.2}
                      strokeOpacity={dimmed ? 0.15 : 1}
                    />
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fontWeight="600"
                      fill={claim.color}
                      opacity={dimmed ? 0.2 : 1}
                      pointerEvents="none"
                    >
                      {claim.label}
                    </text>
                    <text
                      x={cx}
                      y={cy + 8}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fill={claim.color}
                      opacity={dimmed ? 0.15 : 0.72}
                      pointerEvents="none"
                    >
                      {claim.score.toFixed(0)}/100
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Right-side claim labels overflow area */}
            {activeClaims.map((claim, i) => {
              const cx = CLAIM_X + claimRadius(claim.score) + 8;
              const cy = claimY(i);
              const dimmed = isDimmed(claim.slug, 'claim');
              return (
                <text
                  key={claim.slug}
                  x={cx}
                  y={cy}
                  dominantBaseline="middle"
                  fontSize={9}
                  fill={claim.color}
                  opacity={dimmed ? 0.15 : 0.65}
                  pointerEvents="none"
                >
                  {claim.confidence}
                </text>
              );
            })}
          </svg>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-20 rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              background: 'var(--surface-default)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              maxWidth: 260,
              lineHeight: 1.6,
            }}
          >
            {tooltip.lines.map((line, i) => (
              <div key={i} style={{ fontWeight: i === 0 ? 600 : 400 }}>{line}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
