'use client';

import { Database, Info, Loader2, Lock } from 'lucide-react';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import { useUserProfile } from '@/hooks/useUserProfile';
import CosmOmicsAIPanel from './CosmOmicsAIPanel';
import CosmOmicsNovaView from './CosmOmicsNovaView';

interface Props {
  datasetId?: string;
  comparisonName: string;
}

/** Same rule as every add-on surface: the per-user Skin claims flag, or an admin role. */
export function hasCosmeticsAccess(
  profile: { role?: string; has_cosmetics_module?: boolean } | null | undefined,
): boolean {
  return (
    !!profile &&
    (profile.role === 'ADMIN' || profile.role === 'SCILICIUM_ADMIN' || profile.has_cosmetics_module === true)
  );
}

function Message({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="py-14 text-center">
      <div className="mx-auto mb-3 flex justify-center text-muted">{icon}</div>
      <h3 className="mb-1 text-title font-medium text-primary">{title}</h3>
      <p className="mx-auto max-w-md text-body-sm text-secondary">{children}</p>
    </div>
  );
}

/** CosmOmics module of a comparison: the pathway nova, then its AI reading. */
export default function CosmOmicsPanel({ datasetId, comparisonName }: Props) {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const unlocked = hasCosmeticsAccess(profile);
  const { data, isLoading, error } = useCosmOmicsNova(datasetId, comparisonName, unlocked);

  if (profileLoading || (unlocked && isLoading)) {
    return (
      <div className="flex items-center justify-center py-16 text-muted" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!unlocked) {
    return (
      <Message icon={<Lock className="h-10 w-10" />} title="CosmOmics is an add-on">
        The CosmOmics pathway nova is part of the Skin claims add-on. Ask your administrator to enable it.
      </Message>
    );
  }

  if (!datasetId) {
    return (
      <Message icon={<Database className="h-10 w-10" />} title="No DEG data">
        CosmOmics needs a DEG dataset with enrichment results for this comparison.
      </Message>
    );
  }

  if (error || !data) {
    return (
      <Message icon={<Database className="h-10 w-10" />} title="No CosmOmics results">
        The nova could not be computed for this comparison. Make sure functional enrichment has been run.
      </Message>
    );
  }

  if (!data.claims.length) {
    const n = data.coverage?.n_terms_significant ?? 0;
    return (
      <Message icon={<Info className="h-10 w-10" />} title="No claim has a significant pathway">
        {n} enriched term{n === 1 ? '' : 's'} at adjusted p &lt; {data.alpha ?? 0.05}, none of them in the claim
        referential for this comparison.
      </Message>
    );
  }

  return (
    <div className="space-y-6">
      <CosmOmicsNovaView
        data={data}
        seed={`${datasetId}|${comparisonName}`}
        filename={`CosmOmics_nova_${comparisonName}`}
      />
      <CosmOmicsAIPanel datasetId={datasetId} comparisonName={comparisonName} />
    </div>
  );
}
