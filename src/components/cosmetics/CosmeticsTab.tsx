'use client';

import { useState } from 'react';
import { Loader2, Database, Info } from 'lucide-react';
import { useCosmeticsData, useUserProfile, CosmeticsResult } from '@/hooks/useCosmetics';
import ClaimsRadar from './ClaimsRadar';
import ClaimCards from './ClaimCards';
import SkinSchematic from './SkinSchematic';
import CosmeticsAIPanel from './CosmeticsAIPanel';
import CosmeticsLockedOverlay from './CosmeticsLockedOverlay';
import ClaimPathwayNetwork from './ClaimPathwayNetwork';
import { DEMO_COSMETICS, DEMO_INTERPRETATION } from './demoData';

interface Props {
  datasetId?: string;
  comparisonName: string;
}

const SUBTABS = [
  { id: 'overview', label: 'Vue d\'ensemble' },
  { id: 'network', label: 'Réseau AOP' },
] as const;

type SubTab = (typeof SUBTABS)[number]['id'];

function CosmeticsContent({
  data,
  datasetId,
  comparisonName,
  demo,
}: {
  data: CosmeticsResult;
  datasetId?: string;
  comparisonName?: string;
  demo?: boolean;
}) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--surface-elevated)', width: 'fit-content' }}>
        {SUBTABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className="rounded-md px-4 py-1.5 text-xs font-medium transition-colors"
            style={
              activeSubTab === tab.id
                ? { background: 'var(--surface-default)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
                : { color: 'var(--text-secondary)' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'overview' && (
        <>
          <SkinSchematic zones={data.skin_zones} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="xl:col-span-5">
              <ClaimsRadar claims={data.claims} />
            </div>
            <div className="xl:col-span-7">
              <CosmeticsAIPanel
                datasetId={datasetId}
                comparisonName={comparisonName}
                demoText={demo ? DEMO_INTERPRETATION : undefined}
              />
            </div>
          </div>
          <ClaimCards claims={data.claims} />

          {data.caveats.length > 0 && (
            <div className="gl-card p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Info className="h-4 w-4" /> Caveats
              </h3>
              <ul className="space-y-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {data.caveats.map((c, i) => (
                  <li key={`${c.term_id}-${i}`}>
                    <span className="font-medium">{c.pathway_name}</span>{' '}
                    <span className="rounded bg-amber-50 px-1 text-amber-700">[{c.flag}]</span>
                    {c.note ? ` — ${c.note}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            {data.coverage.n_matched}/{data.coverage.n_significant} significant pathways
            matched the claim referential ({Math.round(data.coverage.match_rate * 100)}% coverage).
          </p>
        </>
      )}

      {activeSubTab === 'network' && (
        <ClaimPathwayNetwork claims={data.claims} />
      )}
    </div>
  );
}

export default function CosmeticsTab({ datasetId, comparisonName }: Props) {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const unlocked =
    !!profile &&
    (profile.role === 'ADMIN' ||
      profile.role === 'SCILICIUM_ADMIN' ||
      profile.has_cosmetics_module === true);

  const {
    data,
    isLoading,
    error,
  } = useCosmeticsData(datasetId, comparisonName, unlocked);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Locked: show the demo preview behind an upsell overlay (no API calls).
  if (!unlocked) {
    return (
      <CosmeticsLockedOverlay>
        <CosmeticsContent data={DEMO_COSMETICS} demo />
      </CosmeticsLockedOverlay>
    );
  }

  if (!datasetId) {
    return (
      <div className="text-center py-16">
        <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No DEG data</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          The Cosmetics module requires a DEG dataset with enrichment results for this comparison.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16">
        <Database className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No cosmetic results</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Could not compute claim scores for this comparison. Make sure enrichment has been run.
        </p>
      </div>
    );
  }

  const hasSignal = data.claims.some((c) => c.n_supporting > 0);
  if (!hasSignal) {
    return (
      <div className="space-y-4">
        <div className="text-center py-10">
          <Info className="mx-auto h-10 w-10 text-gray-300 mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No claim significantly supported</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {data.coverage.n_matched}/{data.coverage.n_significant} enriched pathways matched the
            referential, but none provided a directional claim signal for this comparison.
          </p>
        </div>
        <SkinSchematic zones={data.skin_zones} />
      </div>
    );
  }

  return (
    <CosmeticsContent data={data} datasetId={datasetId} comparisonName={comparisonName} />
  );
}
