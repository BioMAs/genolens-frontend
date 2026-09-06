'use client';

import { useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import ProjectList from '@/components/ProjectList';
import CreateProjectModal from '@/components/CreateProjectModal';
import { EmptyStateHelix } from '@/components/ui/empty-state-helix';
import { useSubscription } from '@/hooks/useSubscription';
import type { ProjectFilters } from '@/hooks/useProjects';

type SortValue = 'updated_at' | 'created_at' | 'name';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'updated_at', label: 'Last updated' },
  { value: 'created_at', label: 'Recently created' },
  { value: 'name', label: 'Name' },
];

const controlStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
};

export default function ProjectsView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortValue>('updated_at');

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: subscription } = useSubscription();
  const isAtProjectLimit =
    subscription?.max_projects != null &&
    (subscription?.project_count ?? 0) >= subscription.max_projects;

  const filters: ProjectFilters = {
    page_size: 100,
    sort_by: sortBy,
    // `name` reads naturally A→Z; dates read newest-first.
    sort_order: sortBy === 'name' ? 'asc' : 'desc',
    ...(search ? { search } : {}),
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="font-display font-bold tracking-tight"
            style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}
          >
            Projects
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Every project you own or have been given access to.
          </p>
        </div>

        <button
          onClick={() => !isAtProjectLimit && setIsModalOpen(true)}
          disabled={isAtProjectLimit}
          title={
            isAtProjectLimit
              ? `Project limit reached (${subscription?.project_count}/${subscription?.max_projects}). Upgrade your plan.`
              : undefined
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: 'var(--sl-purple)' }}
          onMouseEnter={(e) => {
            if (!isAtProjectLimit)
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)';
          }}
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
          }
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search projects…"
            aria-label="Search projects"
            className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm transition-all focus-visible:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            style={controlStyle}
          />
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortValue)}
          aria-label="Sort projects by"
          className="h-9 rounded-lg border px-3 text-sm"
          style={controlStyle}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <ProjectList
        filters={filters}
        onCreateClick={() => setIsModalOpen(true)}
        emptyState={
          search ? (
            <EmptyStateHelix
              title="No matching projects"
              description={`Nothing matches “${search}”.`}
              action={
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: 'var(--sl-purple)' }}
                >
                  Clear search
                </button>
              }
            />
          ) : undefined
        }
      />

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
