'use client';

import { CosmeticsResult } from '@/hooks/useCosmetics';
import SkinStack from './SkinStack';
import ClaimRings from './ClaimRings';
import PathwayThemeGroups from './PathwayThemeGroups';
import ClaimCards from '../cosmetics/ClaimCards';
import CosmeticsAIPanel from '../cosmetics/CosmeticsAIPanel';
import { DEMO_INTERPRETATION } from '../cosmetics/demoData';

interface Props {
  data: CosmeticsResult;
  datasetId?: string;
  comparisonName?: string;
  demo?: boolean;
}

function buildHeadline(data: CosmeticsResult): string {
  const favorable = data.claims
    .filter((c) => c.direction === 'favorable' && c.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!favorable.length) return 'Mixed transcriptional signal across skin claims';
  const labels = favorable.slice(0, 3).map((c) => c.label.toLowerCase());
  if (labels.length === 1) return `Signals point to ${labels[0]}`;
  const head = labels.slice(0, -1).join(', ');
  return `Signals point to ${head} & ${labels[labels.length - 1]}`;
}

export default function SkinEffectView({ data, datasetId, comparisonName, demo }: Props) {
  const favorable = data.claims.filter((c) => c.direction === 'favorable' && c.score > 0).length;
  const toWatch = data.claims.filter((c) => c.direction === 'unfavorable' && c.score > 0).length;
  const headline = buildHeadline(data);

  return (
    <div className="space-y-5">
      {/* HERO VERDICT */}
      <div className="gl-card p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div
              className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.6px]"
              style={{ color: 'var(--sl-teal)' }}
            >
              The verdict
            </div>
            <h2
              className="font-display text-[24px] font-semibold leading-[1.25] tracking-[-0.5px]"
              style={{ color: 'var(--text-primary)', maxWidth: 640 }}
            >
              {headline}
            </h2>
          </div>
          <div
            className="flex flex-none items-center gap-2.5 rounded-xl border px-4 py-2.5"
            style={{
              background: 'var(--sl-teal-light)',
              borderColor: 'var(--sl-teal-muted)',
            }}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--dc-green)' }} />
            <span className="text-[13px] font-semibold" style={{ color: 'var(--sl-teal)' }}>
              {favorable} favorable {favorable === 1 ? 'claim' : 'claims'} · {toWatch} to watch
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.05fr_1fr]">
          <SkinStack zones={data.skin_zones} />
          <ClaimRings claims={data.claims} />
        </div>
      </div>

      {/* PATHWAYS DRIVING THE EFFECT */}
      <PathwayThemeGroups claims={data.claims} />

      {/* AI INTERPRETATION (existing, gated) */}
      <CosmeticsAIPanel
        datasetId={datasetId}
        comparisonName={comparisonName}
        demoText={demo ? DEMO_INTERPRETATION : undefined}
      />

      {/* DETAILED CLAIM BREAKDOWN */}
      <ClaimCards claims={data.claims} />

      <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
        {data.coverage.n_matched}/{data.coverage.n_significant} significant pathways matched the claim
        referential ({Math.round(data.coverage.match_rate * 100)}% coverage).
      </p>
    </div>
  );
}
