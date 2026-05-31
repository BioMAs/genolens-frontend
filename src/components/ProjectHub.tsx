'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useProjectSummary, useProjectDatasets, ComparisonSummary } from '@/hooks/useProjectData';
import { useAnalyses } from '@/hooks/useAnalyses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectMembers } from '@/hooks/useProjectMembers';
import { DatasetType, DatasetStatus, SelfServiceAnalysisStatus, Dataset } from '@/types';
import AnalysisStatusCard from '@/components/analyses/AnalysisStatusCard';
import BookmarkManager from '@/components/BookmarkManager';
import GeneListManager from '@/components/GeneListManager';
import ProjectMembersModal from '@/components/ProjectMembersModal';
import { ProjectDetailSkeleton } from '@/components/Skeletons';
import {
  ArrowLeft, Plus, Upload, Users, Star, List,
  FlaskConical, ChevronDown, ChevronUp,
  GitCompare, Layers, Activity, Database, Eye,
} from 'lucide-react';
import GenerateReportButton from '@/components/GenerateReportButton';
import api from '@/utils/api';

interface ProjectHubProps {
  projectId: string;
}

type ProjectTab = 'overview' | 'data';

export default function ProjectHub({ projectId }: ProjectHubProps) {
  const { user: currentUser } = useCurrentUser();
  const { data: summary, isLoading } = useProjectSummary(projectId);
  const { data: datasets = [], refetch: refetchDatasets } = useProjectDatasets(projectId);
  const { data: analysesData } = useAnalyses(projectId);
  const { data: membersData } = useProjectMembers(projectId);

  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [isGeneListModalOpen, setGeneListModalOpen] = useState(false);
  const [isMembersModalOpen, setMembersModalOpen] = useState(false);

  const project  = summary?.project;
  const stats    = summary?.stats;
  const analyses = analysesData?.items ?? [];

  const isOwner = !!project && !!currentUser && project.owner_id === currentUser.id;
  const currentMember = membersData?.members?.find(m => m.user_id === currentUser?.id);
  const canManageData = isOwner || currentMember?.access_level === 'ADMIN';

  const hasAnalyses = analyses.length > 0;
  const comparisons = summary?.comparisons ?? [];

  if (isLoading) return <ProjectDetailSkeleton />;
  if (!project)  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Project not found.</p>
    </div>
  );

  // Separate running from completed analyses
  const runningAnalyses = analyses.filter(
    a => a.status === SelfServiceAnalysisStatus.PENDING || a.status === SelfServiceAnalysisStatus.RUNNING
  );
  const doneAnalyses = analyses.filter(
    a => a.status === SelfServiceAnalysisStatus.DONE
  );
  const failedAnalyses = analyses.filter(
    a => a.status === SelfServiceAnalysisStatus.FAILED || a.status === SelfServiceAnalysisStatus.CANCELLED
  );

  const sourceDatasets = datasets.filter(d =>
    d.type === DatasetType.MATRIX ||
    d.type === DatasetType.METADATA_SAMPLE ||
    d.type === DatasetType.METADATA_CONTRAST
  );

  // Comparisons not linked to any platform analysis (imported externally)
  const linkedDatasetIds = new Set(doneAnalyses.flatMap(a => a.result_dataset_ids ?? []));
  const orphanedComparisons = comparisons.filter(c => !linkedDatasetIds.has(c.dataset_id));
  const hasOrphanedData = orphanedComparisons.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              {project.description && (
                <p className="mt-1 text-sm text-gray-500">{project.description}</p>
              )}
            </div>
            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {comparisons.length >= 2 && (
                <Link
                  href={`/projects/${projectId}/multi-comparison`}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  <GitCompare className="h-3.5 w-3.5" /> Multi-comparison
                </Link>
              )}
              <button
                onClick={() => setBookmarkModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <Star className="h-3.5 w-3.5" /> Bookmarks
              </button>
              <button
                onClick={() => setGeneListModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
              >
                <List className="h-3.5 w-3.5" /> Gene Lists
              </button>
              {isOwner && (
                <button
                  onClick={() => setMembersModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  <Users className="h-3.5 w-3.5" /> Members
                </button>
              )}
              <GenerateReportButton projectId={projectId} />
            </div>
          </div>

          {/* Stats strip */}
          {stats && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
              <StatChip label="Analyses" value={analyses.length} />
              <StatChip label="Comparisons" value={comparisons.length} />
              <StatChip label="Datasets" value={stats.total_datasets} />
              {(stats.processing_count ?? 0) > 0 && (
                <StatChip label="Processing" value={stats.processing_count} accent />
              )}
            </div>
          )}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="flex overflow-x-auto border-b border-gray-100">
            <TabBtn id="overview" active={activeTab} label="Overview" icon={<FlaskConical className="h-3.5 w-3.5" />} onClick={setActiveTab} />
            <TabBtn
              id="data"
              active={activeTab}
              label={`Data Files (${sourceDatasets.length})`}
              icon={<Layers className="h-3.5 w-3.5" />}
              onClick={setActiveTab}
            />
          </div>

          {/* ── Tab content ──────────────────────────────────────────────────── */}
          <div className="p-5">

            {/* OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Empty state */}
                {!hasAnalyses && !hasOrphanedData && (
                  <div className="rounded-2xl border-2 border-dashed border-indigo-200 p-10 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
                      <FlaskConical className="h-7 w-7 text-indigo-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900">Ready to analyse?</h2>
                    <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
                      Upload your expression data and run a guided differential expression analysis
                      with clustering and pathway enrichment.
                    </p>
                    <Link
                      href={`/projects/${projectId}/setup`}
                      className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4" /> Start New Analysis
                    </Link>
                  </div>
                )}

                {/* Imported / external results */}
                {hasOrphanedData && (
                  <ImportedResultsSection
                    projectId={projectId}
                    comparisons={orphanedComparisons}
                    datasets={datasets}
                  />
                )}

                {/* Running analyses */}
                {runningAnalyses.length > 0 && (
                  <Section title="Running" badge={runningAnalyses.length} badgeColor="blue">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {runningAnalyses.map(a => (
                        <AnalysisStatusCard key={a.id} analysis={a} projectId={projectId} />
                      ))}
                    </div>
                  </Section>
                )}

                {/* Completed analyses */}
                {doneAnalyses.length > 0 && (
                  <Section
                    title="Completed Analyses"
                    badge={doneAnalyses.length}
                    badgeColor="green"
                    action={
                      <Link
                        href={`/projects/${projectId}/setup`}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> New Analysis
                      </Link>
                    }
                  >
                    <div className="space-y-3">
                      {doneAnalyses.map(a => (
                        <CompletedAnalysisRow
                          key={a.id}
                          analysis={a}
                          projectId={projectId}
                          comparisons={comparisons.filter(c =>
                            a.result_dataset_ids.some(id => c.dataset_id === id)
                          )}
                          matrixDatasetId={a.matrix_dataset_id}
                          firstResultDatasetId={a.result_dataset_ids[0] ?? null}
                        />
                      ))}
                    </div>
                  </Section>
                )}

                {/* New Analysis CTA when all are running / failed */}
                {hasAnalyses && doneAnalyses.length === 0 && runningAnalyses.length === 0 && (
                  <div className="flex justify-end">
                    <Link
                      href={`/projects/${projectId}/setup`}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-4 w-4" /> New Analysis
                    </Link>
                  </div>
                )}

                {/* Failed analyses */}
                {failedAnalyses.length > 0 && (
                  <Section title="Failed / Cancelled" badge={failedAnalyses.length} badgeColor="red" collapsed>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {failedAnalyses.map(a => (
                        <AnalysisStatusCard key={a.id} analysis={a} projectId={projectId} />
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            )}

            {/* DATA FILES */}
            {activeTab === 'data' && (
              <div className="divide-y divide-gray-50">
                {sourceDatasets.length === 0 && (
                  <p className="py-4 text-sm text-gray-400">No source files uploaded yet.</p>
                )}
                {sourceDatasets.map(d => (
                  <div key={d.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{d.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {d.type} · {d.status}
                      </p>
                    </div>
                    <DatasetStatusDot status={d.status} />
                  </div>
                ))}
                {canManageData && (
                  <div className="pt-3">
                    <Link
                      href={`/projects/${projectId}/setup`}
                      className="flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload via new analysis wizard
                    </Link>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Bookmark Modal */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[80vh] rounded-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">My Bookmarks</h2>
              <button onClick={() => setBookmarkModalOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6"><BookmarkManager projectId={projectId} /></div>
          </div>
        </div>
      )}

      {/* Gene List Modal */}
      {isGeneListModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[80vh] rounded-xl bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">My Gene Lists</h2>
              <button onClick={() => setGeneListModalOpen(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6"><GeneListManager projectId={projectId} /></div>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {isMembersModalOpen && project && currentUser && (
        <ProjectMembersModal
          projectId={projectId}
          projectOwnerId={project.owner_id}
          currentUserId={currentUser.id}
          isOpen={isMembersModalOpen}
          onClose={() => setMembersModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Imported / External results section ─────────────────────────────────────
type ImportedTab = 'comparisons';

function ImportedResultsSection({
  projectId,
  comparisons,
  datasets,
}: {
  projectId: string;
  comparisons: ComparisonSummary[];
  datasets: Dataset[];
}) {
  const [activeTab, setActiveTab] = useState<ImportedTab>('comparisons');

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Imported Results</span>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {comparisons.length} comparison{comparisons.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Link
          href={`/projects/${projectId}/setup`}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" /> New Analysis
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('comparisons')}
          className={`shrink-0 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'comparisons'
              ? 'border-indigo-500 text-indigo-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Comparisons
          </span>
        </button>
      </div>

      {/* Tab content */}
      <div className="p-5">
        {/* Comparisons */}
        {activeTab === 'comparisons' && (
          <div className="space-y-1.5">
            {comparisons.map(c => (
              <Link
                key={c.name}
                href={`/projects/${projectId}/comparisons/${encodeURIComponent(c.name)}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-indigo-400 shrink-0" />
                  <div>
                    <p className="font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
                      {c.has_enrichment && (
                        <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium">
                          Enrichment
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-red-500 text-xs">↑{c.deg_up}</span>
                  <span className="font-semibold text-blue-500 text-xs">↓{c.deg_down}</span>
                  <Eye className="h-4 w-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title, badge, badgeColor = 'gray', action, collapsed = false, children,
}: {
  title: string;
  badge?: number;
  badgeColor?: 'gray' | 'green' | 'blue' | 'red';
  action?: React.ReactNode;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsed);
  const badgeStyles: Record<string, string> = {
    gray:  'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-700',
    blue:  'bg-blue-100 text-blue-700',
    red:   'bg-red-100 text-red-700',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-800"
        >
          {title}
          {badge !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyles[badgeColor]}`}>
              {badge}
            </span>
          )}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
        </button>
        {action}
      </div>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─── Completed analysis row ───────────────────────────────────────────────────
function CompletedAnalysisRow({
  analysis,
  projectId,
  comparisons,
  matrixDatasetId,
  firstResultDatasetId,
}: {
  analysis: { id: string; name: string; created_at: string };
  projectId: string;
  comparisons: { name: string; deg_up: number; deg_down: number }[];
  matrixDatasetId: string | null;
  firstResultDatasetId: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-100"
      >
        <div>
          <p className="text-sm font-semibold text-gray-900">{analysis.name}</p>
          <p className="text-xs text-gray-400">
            {new Date(analysis.created_at).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            {comparisons.length > 0 && ` · ${comparisons.length} comparison${comparisons.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Done</span>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-200 px-4 py-3 space-y-3">
          {/* Quick links */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/projects/${projectId}/analyses/${analysis.id}`}
              className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <FlaskConical className="h-3.5 w-3.5" /> Analysis results
            </Link>
            {matrixDatasetId && (
              <Link
                href={`/projects/${projectId}/datasets/${matrixDatasetId}/clustering`}
                className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
              >
                <Layers className="h-3.5 w-3.5" /> Clustering
              </Link>
            )}
            {firstResultDatasetId && (
              <Link
                href={`/projects/${projectId}/datasets/${firstResultDatasetId}/enrichment`}
                className="flex items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100"
              >
                <FlaskConical className="h-3.5 w-3.5" /> Enrichment
              </Link>
            )}
          </div>

          {/* Comparisons */}
          {comparisons.length > 0 && (
            <div className="space-y-1.5">
              {comparisons.map(c => (
                <Link
                  key={c.name}
                  href={`/projects/${projectId}/comparisons/${encodeURIComponent(c.name)}`}
                  className="flex items-center justify-between rounded-lg bg-white border border-gray-200 px-3 py-2 text-xs hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="font-medium text-gray-800 truncate">{c.name}</span>
                  <span className="ml-3 shrink-0 font-medium">
                    <span className="text-red-500">↑{c.deg_up}</span>
                    {' '}
                    <span className="text-blue-500">↓{c.deg_down}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function StatChip({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`flex items-center gap-1 text-xs ${accent ? 'text-amber-600' : 'text-gray-500'}`}>
      <span className={`font-semibold ${accent ? 'text-amber-700' : 'text-gray-800'}`}>
        {value.toLocaleString()}
      </span>
      {label}
    </div>
  );
}

function DatasetStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    READY:      'bg-green-400',
    PROCESSING: 'bg-blue-400 animate-pulse',
    PENDING:    'bg-yellow-400 animate-pulse',
    FAILED:     'bg-red-400',
  };
  return <div className={`h-2 w-2 rounded-full shrink-0 ${colors[status] ?? 'bg-gray-300'}`} />;
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function TabBtn({
  id, active, label, icon, onClick, badge,
}: {
  id: ProjectTab;
  active: ProjectTab;
  label: string;
  icon: React.ReactNode;
  onClick: (id: ProjectTab) => void;
  badge?: 'ready' | 'na';
}) {
  const isActive = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`shrink-0 flex items-center gap-1.5 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
        isActive
          ? 'border-indigo-500 text-indigo-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
      {badge === 'ready' && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-400 ml-0.5" />
      )}
      {badge === 'na' && (
        <span className="text-xs text-gray-400 opacity-60">(N/A)</span>
      )}
    </button>
  );
}

