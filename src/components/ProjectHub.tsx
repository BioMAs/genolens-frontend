'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjectSummary, useProjectDatasets } from '@/hooks/useProjectData';
import { useAnalyses } from '@/hooks/useAnalyses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { DatasetStatus, DatasetType, SelfServiceAnalysisStatus, Dataset } from '@/types';
import BookmarkManager from '@/components/BookmarkManager';
import GeneListManager from '@/components/GeneListManager';
import ProjectMembersModal from '@/components/ProjectMembersModal';
import ProjectHistory from '@/components/ProjectHistory';
import { ProjectDetailSkeleton } from '@/components/Skeletons';
import { StatChip } from '@/components/ui/stat-chip';
import { Dot } from '@/components/ui/dot';
import { Chip } from '@/components/ui/chip';
import { EmptyStateHelix } from '@/components/ui/empty-state-helix';
import {
  ArrowLeft,
  Plus,
  Upload,
  Users,
  Star,
  List,
  GitCompare,
  Database,
  FlaskConical,
  Clock,
  ArrowRight,
  Layers,
  Activity,
  BarChart3,
} from 'lucide-react';
import GenerateReportButton from '@/components/GenerateReportButton';

interface ProjectHubProps {
  projectId: string;
}

type ProjectTab = 'comparisons' | 'datasets' | 'qc' | 'pca' | 'history';

export default function ProjectHub({ projectId }: ProjectHubProps) {
  const { user: currentUser } = useCurrentUser();
  const { data: summary, isLoading } = useProjectSummary(projectId);
  const { data: datasets = [] } = useProjectDatasets(projectId);
  const { data: analysesData } = useAnalyses(projectId);
  const { data: membersData } = useProjectMembers(projectId);

  const [activeTab, setActiveTab] = useState<ProjectTab>('comparisons');
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [isGeneListModalOpen, setGeneListModalOpen] = useState(false);
  const [isMembersModalOpen, setMembersModalOpen] = useState(false);

  const project = summary?.project;
  const stats = summary?.stats;
  const comparisons = summary?.comparisons ?? [];
  const analyses = analysesData?.items ?? [];

  const isOwner = !!project && !!currentUser && project.owner_id === currentUser.id;
  const currentMember = membersData?.members?.find((m) => m.user_id === currentUser?.id);
  const canManageData = isOwner || currentMember?.access_level === 'ADMIN';

  const runningAnalyses = analyses.filter(
    (a) =>
      a.status === SelfServiceAnalysisStatus.PENDING ||
      a.status === SelfServiceAnalysisStatus.RUNNING,
  );

  const sourceDatasets = datasets.filter(
    (d) =>
      d.type === DatasetType.MATRIX ||
      d.type === DatasetType.METADATA_SAMPLE ||
      d.type === DatasetType.METADATA_CONTRAST,
  );

  const readyDataset = useMemo(
    () => sourceDatasets.find((d) => d.status === DatasetStatus.READY),
    [sourceDatasets],
  );

  if (isLoading) return <ProjectDetailSkeleton />;
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: 'var(--text-muted)' }}>Project not found.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="mb-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{project.name}</h1>
          {project.description ? (
            <p className="mt-1 max-w-3xl text-sm" style={{ color: 'var(--text-secondary)' }}>
              {project.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {comparisons.length >= 2 && (
            <Link
              href={`/projects/${projectId}/multi-comparison`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <Layers className="h-3.5 w-3.5" /> Multi-Comparison
            </Link>
          )}

          <button
            onClick={() => setBookmarkModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <Star className="h-3.5 w-3.5" /> Bookmarks
          </button>

          <button
            onClick={() => setGeneListModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
            }}
          >
            <List className="h-3.5 w-3.5" /> Gene Lists
          </button>

          {isOwner ? (
            <button
              onClick={() => setMembersModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text-secondary)',
              }}
            >
              <Users className="h-3.5 w-3.5" /> Members
            </button>
          ) : null}

          <GenerateReportButton projectId={projectId} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatChip
          icon={<GitCompare className="h-4 w-4" />}
          value={comparisons.length}
          label="Comparisons"
          tone="teal"
        />
        <StatChip
          icon={<Database className="h-4 w-4" />}
          value={stats?.total_datasets ?? 0}
          label="Datasets"
          tone="purple"
        />
        <StatChip
          icon={<FlaskConical className="h-4 w-4" />}
          value={analyses.length}
          label="Analyses"
          tone="neutral"
        />
        <StatChip
          icon={<Upload className="h-4 w-4" />}
          value={stats?.original_files_count ?? 0}
          label="Original Files"
          tone="neutral"
        />
      </div>

      <div
        className="mt-5 inline-flex flex-wrap rounded-xl p-1"
        style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <ProjectTabButton id="comparisons" activeTab={activeTab} onClick={setActiveTab} label="Comparisons" />
        <ProjectTabButton id="datasets" activeTab={activeTab} onClick={setActiveTab} label="Datasets" />
        <ProjectTabButton id="qc" activeTab={activeTab} onClick={setActiveTab} label="QC" />
        <ProjectTabButton id="pca" activeTab={activeTab} onClick={setActiveTab} label="PCA" />
        <ProjectTabButton id="history" activeTab={activeTab} onClick={setActiveTab} label="History" />
      </div>

      {activeTab === 'comparisons' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-3">
            {comparisons.length === 0 ? (
              <EmptyStateHelix
                title="No comparisons yet"
                description="Upload data and configure your first differential expression comparison."
                action={
                  <Link
                    href={`/projects/${projectId}/setup`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white"
                    style={{ background: 'var(--sl-purple)' }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Start Analysis
                  </Link>
                }
              />
            ) : (
              comparisons.map((comparison) => (
                <ComparisonCard
                  key={comparison.name}
                  projectId={projectId}
                  name={comparison.name}
                  up={comparison.deg_up}
                  down={comparison.deg_down}
                  hasEnrichment={comparison.has_enrichment}
                />
              ))
            )}

            {runningAnalyses.length > 0 ? (
              <div className="gl-card p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  <Clock className="h-4 w-4" /> Processing
                </div>
                <div className="space-y-2">
                  {runningAnalyses.map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-raised)' }}>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{analysis.name}</span>
                      <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Dot variant="processing" size={7} /> {analysis.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-4 space-y-3">
            <div className="gl-card p-4">
              <div className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                Add Data
              </div>
              <Link
                href={`/projects/${projectId}/setup`}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Drop CSV / TSV / Excel or open setup wizard</span>
                <Chip>Counts matrix · DEG · metadata</Chip>
              </Link>
            </div>

            <DatasetListCard datasets={sourceDatasets} />

            {canManageData ? (
              <Link
                href={`/projects/${projectId}/setup`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--sl-purple)' }}
              >
                <Plus className="h-3.5 w-3.5" /> New Analysis
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === 'datasets' ? (
        <div className="mt-4 gl-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Source datasets
            </h2>
            {canManageData ? (
              <Link
                href={`/projects/${projectId}/setup`}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                style={{ background: 'var(--sl-purple)' }}
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Link>
            ) : null}
          </div>

          {sourceDatasets.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No source files uploaded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {sourceDatasets.map((dataset) => (
                <div key={dataset.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: 'var(--surface-raised)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{dataset.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{dataset.type}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <DatasetStatusDot status={dataset.status} /> {dataset.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'qc' ? (
        <InfoTabCard
          title="Quality Control"
          description="Review preprocessing quality metrics and input data integrity."
          ctaLabel="Open QC"
          ctaHref={readyDataset ? `/projects/${projectId}/datasets/${readyDataset.id}` : undefined}
        />
      ) : null}

      {activeTab === 'pca' ? (
        <InfoTabCard
          title="PCA / Clustering"
          description="Explore global sample structure and clustering views from normalized matrices."
          ctaLabel="Open PCA"
          ctaHref={readyDataset ? `/projects/${projectId}/datasets/${readyDataset.id}/clustering` : undefined}
        />
      ) : null}

      {activeTab === 'history' ? (
        <div className="mt-4">
          <ProjectHistory projectId={projectId} />
        </div>
      ) : null}

      {isBookmarkModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">My Bookmarks</h2>
              <button
                onClick={() => setBookmarkModalOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <BookmarkManager projectId={projectId} />
            </div>
          </div>
        </div>
      ) : null}

      {isGeneListModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">My Gene Lists</h2>
              <button
                onClick={() => setGeneListModalOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <GeneListManager projectId={projectId} />
            </div>
          </div>
        </div>
      ) : null}

      {isMembersModalOpen && project && currentUser ? (
        <ProjectMembersModal
          projectId={projectId}
          projectOwnerId={project.owner_id}
          currentUserId={currentUser.id}
          isOpen={isMembersModalOpen}
          onClose={() => setMembersModalOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ProjectTabButton({
  id,
  activeTab,
  onClick,
  label,
}: {
  id: ProjectTab;
  activeTab: ProjectTab;
  onClick: (id: ProjectTab) => void;
  label: string;
}) {
  const active = id === activeTab;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      style={
        active
          ? { background: 'var(--sl-teal-light)', color: 'var(--sl-teal-dark)' }
          : { color: 'var(--text-secondary)' }
      }
    >
      {label}
    </button>
  );
}

function ComparisonCard({
  projectId,
  name,
  up,
  down,
  hasEnrichment,
}: {
  projectId: string;
  name: string;
  up: number;
  down: number;
  hasEnrichment: boolean;
}) {
  return (
    <div className="gl-card gl-card-interactive flex items-center justify-between gap-4 p-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {name}
          </span>
          <Chip icon={<Activity className="h-3 w-3" />}>DEG</Chip>
          {hasEnrichment ? <Chip icon={<BarChart3 className="h-3 w-3" />}>GSEA</Chip> : null}
        </div>

        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span>
            <span style={{ color: 'var(--sl-teal)', fontWeight: 600 }}>↑ {up.toLocaleString()}</span> up
          </span>
          <span>
            <span style={{ color: 'var(--sl-purple)', fontWeight: 600 }}>↓ {down.toLocaleString()}</span> down
          </span>
          <span>{(up + down).toLocaleString()} total DEGs</span>
        </div>
      </div>

      <Link
        href={`/projects/${projectId}/comparisons/${encodeURIComponent(name)}`}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        Analyze <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DatasetListCard({ datasets }: { datasets: Dataset[] }) {
  return (
    <div className="gl-card p-4">
      <div className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
        Datasets
      </div>

      {datasets.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          No source datasets yet.
        </p>
      ) : (
        <div className="space-y-2">
          {datasets.slice(0, 6).map((dataset) => (
            <div key={dataset.id} className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="truncate" title={dataset.name}>
                {dataset.name}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs">
                <DatasetStatusDot status={dataset.status} /> {dataset.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoTabCard({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
}) {
  return (
    <div className="mt-4 gl-card p-5">
      <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        {description}
      </p>
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: 'var(--sl-purple)' }}
        >
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          A ready matrix dataset is required first.
        </p>
      )}
    </div>
  );
}

function DatasetStatusDot({ status }: { status: string }) {
  if (status === DatasetStatus.READY) {
    return <Dot variant="ready" size={7} />;
  }
  if (status === DatasetStatus.PROCESSING) {
    return <Dot variant="processing" size={7} />;
  }
  if (status === DatasetStatus.FAILED) {
    return <Dot variant="failed" size={7} />;
  }
  return <Dot variant="pending" size={7} />;
}
