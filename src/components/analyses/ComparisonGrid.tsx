'use client';

import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { ComparisonSummary } from '@/hooks/useProjectData';

interface ComparisonGridProps {
  projectId: string;
  analysisId?: string;
  comparisons: ComparisonSummary[];
  matrixDatasetId?: string | null;
}

export default function ComparisonGrid({ projectId, analysisId, comparisons }: ComparisonGridProps) {
  if (comparisons.length === 0) {
    return (
      <div className="gl-card p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No comparisons available for this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {comparisons.map((comp) => (
        <Link
          key={comp.name}
          href={
            analysisId
              ? `/projects/${projectId}/analyses/${analysisId}/comparisons/${encodeURIComponent(comp.name)}`
              : `/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}`
          }
          className="group flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-all"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--sl-teal-muted)';
            e.currentTarget.style.background = 'var(--sl-teal-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.background = 'var(--surface)';
          }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{comp.name}</p>
            <div className="mt-1 flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--dc-up-dark)' }}>
                <TrendingUp className="h-3 w-3" /> {comp.deg_up} up
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--dc-down-dark)' }}>
                <TrendingDown className="h-3 w-3" /> {comp.deg_down} down
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{comp.deg_total} total DEGs</span>
              {comp.has_enrichment && (
                <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ background: 'var(--sl-teal-light)', color: 'var(--sl-teal)' }}>
                  Enrichment
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 transition-colors" style={{ color: 'var(--text-muted)' }} />
        </Link>
      ))}
    </div>
  );
}

