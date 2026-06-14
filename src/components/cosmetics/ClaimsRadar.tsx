'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { CosmeticClaimScore } from '@/hooks/useCosmetics';
import PanelInfo from './PanelInfo';

interface ClaimsRadarProps {
  claims: CosmeticClaimScore[];
}

/** Spider chart of cosmetic claim activation scores (0-100). */
export default function ClaimsRadar({ claims }: ClaimsRadarProps) {
  const data = claims.map((c) => ({
    claim: c.label.replace(/ & /g, ' &\n'),
    score: c.score,
    confidence: c.confidence,
  }));

  return (
    <div className="gl-card p-4">
      <div className="mb-1 flex items-center gap-1.5">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Skin claim profile
        </h3>
        <PanelInfo title="Skin claim profile — how the score is computed">
          <p>
            Each axis is a cosmetic <b>claim</b> with an <b>activation score from 0
            to 100</b>, summarizing how strongly and how consistently the modulated
            pathways support that claim in this comparison.
          </p>
          <p><b>How the score is built</b></p>
          <ul>
            <li>Enriched pathways are matched to a curated referential that links each pathway to one or more claims and to the <b>direction</b> (up- or down-regulation) that <i>supports</i> that claim.</li>
            <li>For every matched pathway we compare the <b>observed direction</b> with the supporting direction: a match adds positive weight, a mismatch adds negative weight.</li>
            <li>Each weight = <b>evidence strength</b> (HIGH/MODERATE/LOW) × <b>statistical significance</b>.</li>
            <li>Score = <b>consistency</b> (share of supporting vs contradicting evidence) × <b>strength</b> (how much evidence accumulated). Both must be high to reach a high score.</li>
          </ul>
          <p><b>How to read it</b></p>
          <ul>
            <li>A <b>large, balanced shape</b> = a broad, well-supported skin benefit profile.</li>
            <li>A <b>spike</b> on one axis = a specific, strongly supported claim.</li>
            <li>A near-zero axis means little or conflicting evidence — not necessarily a negative effect.</li>
          </ul>
        </PanelInfo>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        Activation score per claim (0–100), based on modulated pathways.
      </p>
      <div style={{ width: '100%', height: 340 }}>
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="var(--border-subtle, #e5e7eb)" />
            <PolarAngleAxis
              dataKey="claim"
              tick={{ fontSize: 11, fill: 'var(--text-secondary, #6b7280)' }}
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#db2777"
              fill="#db2777"
              fillOpacity={0.35}
            />
            <Tooltip formatter={(value) => [`${value as number}/100`, 'Score']} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
