'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAnalyses } from '@/hooks/useAnalyses';
import { useProjectDatasets } from '@/hooks/useProjectData';
import AnalysisStatusCard from '@/components/analyses/AnalysisStatusCard';
import { useAutoTour } from '@/hooks/useAutoTour';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';

interface Props {
  projectId: string;
}

export default function AnalysesListView({ projectId }: Props) {
  useAutoTour('analyses');
  const { data, isLoading, isError } = useAnalyses(projectId);
  const { data: datasets } = useProjectDatasets(projectId);
  const { canManageData } = useProjectPermissions(projectId);

  // Map matrix_dataset_id → GEO accession for datasets imported from NCBI GEO.
  const geoByDatasetId = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of datasets ?? []) {
      const meta = d.dataset_metadata as { source?: string; geo_accession?: string } | undefined;
      if (meta?.source === 'GEO' && meta.geo_accession) {
        map.set(d.id, meta.geo_accession);
      }
    }
    return map;
  }, [datasets]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted text-body-sm">
        Loading…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-sm bg-danger-soft p-4 text-body-sm text-danger-ink">
        Failed to load analyses.
      </div>
    );
  }

  const analyses = data?.items ?? [];

  return (
    <div className="space-y-6" data-tour="analyses-list">
      <div className="flex items-center justify-between">
        <h2 className="text-title text-primary">
          Self-service analyses ({analyses.length})
        </h2>
        {/* Same entry point as the overview's « New analysis »: the setup
            wizard. Only the owner or an ADMIN member may launch. */}
        {canManageData ? (
          <Link
            data-tour="analyses-new"
            href={`/projects/${projectId}/setup`}
            className="inline-flex items-center rounded-sm bg-accent px-4 py-2 text-body-sm font-semibold text-on-accent shadow hover:bg-accent-hover"
          >
            + New analysis
          </Link>
        ) : null}
      </div>

      {analyses.length === 0 ? (
        <div className="rounded-control border-2 border-dashed border-line p-12 text-center">
          <p className="text-body-sm text-secondary">No analyses launched for this project.</p>
          {canManageData ? (
            <Link
              href={`/projects/${projectId}/setup`}
              className="mt-4 inline-flex items-center rounded-sm bg-accent px-4 py-2 text-body-sm font-semibold text-on-accent shadow hover:bg-accent-hover"
            >
              Launch your first analysis
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analyses.map((a) => (
            <AnalysisStatusCard
              key={a.id}
              analysis={a}
              projectId={projectId}
              geoAccession={a.matrix_dataset_id ? geoByDatasetId.get(a.matrix_dataset_id) : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
