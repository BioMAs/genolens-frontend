'use client';

import { useState } from 'react';
import { useProjects, usePrefetchProject, type ProjectFilters } from '@/hooks/useProjects';
import { useProjectDashboardStats } from '@/hooks/useProjectDashboardStats';
import { Folder, Plus, Calendar, ChevronRight, AlertCircle, Database, GitCompare, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Project } from '@/types';
import DeleteProjectModal from './DeleteProjectModal';

function ProjectCardStats({ project }: { project: Project }) {
  const { data: stats } = useProjectDashboardStats(project.id);
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <Database className="h-3 w-3" />
        {stats?.total_datasets ?? '—'}
      </span>
      <span
        className="inline-flex items-center gap-1 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <GitCompare className="h-3 w-3" />
        {stats?.total_comparisons ?? '—'}
      </span>
    </div>
  );
}

interface ProjectListProps {
  onCreateClick: () => void;
  /**
   * Query filters for the underlying list. Passed in rather than fetched here so
   * the owning page controls search and sort — and so the page and the grid share
   * one request instead of issuing two under different cache keys.
   */
  filters?: ProjectFilters;
  /** Shown instead of the "no projects yet" pitch when a search returns nothing. */
  emptyState?: React.ReactNode;
}

export default function ProjectList({ onCreateClick, filters, emptyState }: ProjectListProps) {
  const { data, isLoading, error } = useProjects(filters);
  const { prefetchProject } = usePrefetchProject();
  const projects = data?.items || [];
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  /* ── Loading ──────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="skeleton rounded-xl"
            style={{ height: '136px', animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        className="flex items-start gap-3 rounded-xl p-4 text-sm animate-fade-up"
        style={{
          background: 'var(--sl-red-light)',
          border: '1px solid var(--sl-red-muted)',
          color: 'var(--sl-red)',
        }}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
        {error instanceof Error ? error.message : 'Failed to load projects. Please try again.'}
      </div>
    );
  }

  /* ── Empty state ──────────────────────────────────────────── */
  if (projects.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    return (
      <div
        className="flex flex-col items-center justify-center py-20 rounded-xl border-2 border-dashed animate-fade-up"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4"
          style={{ background: 'var(--sl-teal-light)' }}
        >
          <Folder className="h-7 w-7" style={{ color: 'var(--sl-teal-dark)' }} />
        </div>
        <h3
          className="font-display text-base font-semibold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          No projects yet
        </h3>
        <p className="text-sm mb-6 text-center max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>
          Create your first project to start analyzing transcriptomics data.
        </p>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all"
          style={{ background: 'var(--sl-purple)' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
          }
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>
    );
  }

  /* ── Project grid ─────────────────────────────────────────── */
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, i) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          onMouseEnter={() => prefetchProject(project.id)}
          className="group gl-card gl-card-interactive flex flex-col p-5 animate-fade-up"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'var(--sl-teal-light)' }}
              >
                <Folder className="h-4.5 w-4.5" style={{ color: 'var(--sl-teal-dark)' }} />
              </div>
              <h3
                className="font-display text-sm font-semibold leading-snug truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {project.name}
              </h3>
            </div>
            <div className="flex items-center flex-shrink-0 mt-0.5">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setProjectToDelete(project);
                }}
                className="opacity-0 group-hover:opacity-100 rounded-md p-1 transition-opacity duration-150 hover:bg-red-50"
                title="Supprimer le projet"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400 hover:text-red-600" />
              </button>
              <ChevronRight
                className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                style={{ color: 'var(--text-muted)' }}
              />
            </div>
          </div>

          {/* Description */}
          <p
            className="text-xs leading-relaxed line-clamp-2 flex-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {project.description || 'No description provided.'}
          </p>

          {/* Footer */}
          <div
            className="mt-3 pt-3 flex items-center justify-between gap-2"
            style={{
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
              {new Date(project.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </div>
            <ProjectCardStats project={project} />
          </div>
        </Link>
      ))}
      <DeleteProjectModal
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
      />
    </div>
  );
}
