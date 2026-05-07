'use client';

import Link from 'next/link';
import { Folder, Database, GitCompare, Clock, ChevronRight } from 'lucide-react';
import { Project } from '@/types';
import { ProjectDashboardStats } from '@/types/project-stats';

interface RecentProjectsSectionProps {
  projects: Project[];
  statsMap: Record<string, ProjectDashboardStats>;
  statsLoading: boolean;
  onCreateClick: () => void;
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function RecentProjectsSection({
  projects,
  statsMap,
  statsLoading,
  onCreateClick,
}: RecentProjectsSectionProps) {
  // Sort by updated_at desc and take top 3
  const recent = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

  if (projects.length === 0) {
    return (
      <div
        className="gl-card flex flex-col items-center justify-center py-12 text-center animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl mb-3"
          style={{ background: 'var(--sl-teal-light)' }}
        >
          <Folder className="h-6 w-6" style={{ color: 'var(--sl-teal-dark)' }} />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          No projects yet
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
          Create your first project to get started.
        </p>
        <button
          onClick={onCreateClick}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition-all"
          style={{ background: 'var(--sl-purple)' }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
          }
        >
          New Project
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '60ms' }}>
      {recent.map((project, i) => {
        const stats = statsMap[project.id];
        return (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group gl-card gl-card-interactive flex items-center gap-4 p-4"
            style={{ animationDelay: `${60 + i * 40}ms` }}
          >
            {/* Icon */}
            <div
              className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--sl-teal-light)' }}
            >
              <Folder className="h-5 w-5" style={{ color: 'var(--sl-teal-dark)' }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p
                className="font-display text-sm font-semibold truncate"
                style={{ color: 'var(--text-primary)' }}
              >
                {project.name}
              </p>

              {/* Mini stats badges */}
              <div className="flex items-center gap-3 mt-1">
                {statsLoading && !stats ? (
                  <div className="skeleton rounded" style={{ height: '14px', width: '80px' }} />
                ) : (
                  <>
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Database className="h-3 w-3" />
                      {stats?.total_datasets ?? 0}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <GitCompare className="h-3 w-3" />
                      {stats?.total_comparisons ?? 0}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Clock className="h-3 w-3" />
                      {formatRelativeDate(stats?.last_activity_at ?? project.updated_at)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight
              className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5"
              style={{ color: 'var(--text-muted)' }}
            />
          </Link>
        );
      })}
    </div>
  );
}
