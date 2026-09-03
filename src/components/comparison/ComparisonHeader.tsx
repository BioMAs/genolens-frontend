'use client';

/**
 * The comparison's identity and its actions, above whichever screen is open.
 *
 * Shared by all four screens, which is what makes it a header rather than a panel: the title,
 * where the comparison came from, the counts, and the three things you can do to the comparison
 * as a whole. Extracted from `ComparisonDetail` unchanged — this is a move, not a redesign.
 *
 * The reprocess action stays a prop rather than living here: its handler owns a five-second
 * poll loop that belongs in a mutation, and moving it into a presentational header would bury
 * that rather than fix it.
 */

import Link from 'next/link';
import { ArrowLeft, Activity, Calendar, Database, RefreshCw, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { Dataset, Project } from '@/types';
import { formatDate } from '@/utils/formatters';
import { StatChip } from '@/components/ui/stat-chip';
import ComparisonReportButton from '@/components/ComparisonReportButton';

export interface ComparisonStats {
  degUp: number;
  degDown: number;
  degTotal: number;
  genesTested?: number;
}

interface Props {
  projectId: string;
  analysisId?: string;
  project: Project;
  degDataset: Dataset;
  decodedName: string;
  actualComparisonName: string;
  stats: ComparisonStats | null;
  statsLoading: boolean;
  reportUnlocked: boolean;
  reprocessing: boolean;
  onReprocess: () => void;
  onOpenChat: () => void;
}

export default function ComparisonHeader({
  projectId,
  analysisId,
  project,
  degDataset,
  decodedName,
  actualComparisonName,
  stats,
  statsLoading,
  reportUnlocked,
  reprocessing,
  onReprocess,
  onOpenChat,
}: Props) {
  return (
    <>
      <Link
        href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
      </Link>

      <div className="gl-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">{decodedName}</h1>
            <div
              className="mt-1 flex flex-wrap items-center gap-4 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Project: {project.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Created {formatDate(degDataset.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenChat}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: 'var(--sl-purple)' }}
              title="Open the AI Assistant for this comparison"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </button>
            {reportUnlocked && (
              <ComparisonReportButton
                datasetId={degDataset.id}
                comparisonName={actualComparisonName}
              />
            )}
            <button
              onClick={onReprocess}
              disabled={reprocessing}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              {reprocessing ? 'Reprocessing…' : 'Reprocess'}
            </button>
          </div>
        </div>

        {statsLoading ? (
          <div
            className="mt-4 inline-flex items-center gap-2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            <RefreshCw className="h-4 w-4 animate-spin" /> Calculating DEG statistics…
          </div>
        ) : stats ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <StatChip
              icon={<TrendingUp className="h-4 w-4" />}
              value={stats.degUp}
              label="Upregulated"
              tone="teal"
            />
            <StatChip
              icon={<TrendingDown className="h-4 w-4" />}
              value={stats.degDown}
              label="Downregulated"
              tone="purple"
            />
            <StatChip
              icon={<Activity className="h-4 w-4" />}
              value={stats.degTotal}
              label="Total DEGs"
              tone="neutral"
            />
            {stats.genesTested ? (
              <StatChip
                icon={<Database className="h-4 w-4" />}
                value={stats.genesTested}
                label="Genes tested"
                tone="neutral"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
