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
      <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Skin claim profile
      </h3>
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
