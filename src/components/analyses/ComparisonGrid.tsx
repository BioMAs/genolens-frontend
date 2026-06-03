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

export default function ComparisonGrid({ projectId, comparisons }: ComparisonGridProps) {
  if (comparisons.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-400">No comparisons available for this analysis.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {comparisons.map((comp) => (
        <Link
          key={comp.name}
          href={`/projects/${projectId}/comparisons/${encodeURIComponent(comp.name)}`}
          className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">
              {comp.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                <TrendingUp className="h-3 w-3" /> {comp.deg_up} up
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                <TrendingDown className="h-3 w-3" /> {comp.deg_down} down
              </span>
              <span className="text-xs text-gray-400">{comp.deg_total} total DEGs</span>
              {comp.has_enrichment && (
                <span className="rounded px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium">
                  Enrichment
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
        </Link>
      ))}
    </div>
  );
}

