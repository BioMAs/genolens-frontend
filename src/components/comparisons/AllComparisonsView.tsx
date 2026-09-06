'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowUpDown, GitCompareArrows, Search } from 'lucide-react';
import {
  useAllComparisons,
  type ComparisonSortField,
  type UserComparisonItem,
} from '@/hooks/useAllComparisons';
import { useProjects } from '@/hooks/useProjects';
import { Badge } from '@/components/ui/badge';
import { EmptyStateHelix } from '@/components/ui/empty-state-helix';

const PAGE_SIZE = 25;

const SORT_OPTIONS: { value: ComparisonSortField; label: string }[] = [
  { value: 'updated_at', label: 'Last updated' },
  { value: 'name', label: 'Comparison name' },
  { value: 'project_name', label: 'Project' },
  { value: 'deg_total', label: 'DEG count' },
];

/** Compact relative date — "3 days ago", "just now". */
function relativeDate(iso: string | null): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';

  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function comparisonHref(item: UserComparisonItem): string {
  return `/projects/${item.project_id}/comparisons/${encodeURIComponent(item.name)}`;
}

const selectStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text-primary)',
};

export default function AllComparisonsView() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sortBy, setSortBy] = useState<ComparisonSortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  // Every filter change also resets the page: page 3 of the previous result set
  // is meaningless against the new one.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: projectsData } = useProjects({ page_size: 100, sort_by: 'name', sort_order: 'asc' });
  const projects = useMemo(() => projectsData?.items ?? [], [projectsData]);

  const { data, isLoading, isFetching, error } = useAllComparisons({
    page,
    page_size: PAGE_SIZE,
    ...(search ? { search } : {}),
    ...(projectId ? { project_id: projectId } : {}),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const comparisons = data?.comparisons ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  // Count what actually came back rather than assuming a full page.
  const lastRow = firstRow + Math.max(comparisons.length - 1, 0);
  const isFiltered = Boolean(search || projectId);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="font-display font-bold tracking-tight"
            style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}
          >
            Comparisons
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Every comparison across your projects.
          </p>
        </div>
      </div>

      {/* Filters */}
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
            placeholder="Search comparisons or projects…"
            aria-label="Search comparisons"
            className="h-9 w-full rounded-lg border pl-9 pr-3 text-sm transition-all focus-visible:border-brand-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            style={selectStyle}
          />
        </div>

        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by project"
          className="h-9 rounded-lg border px-3 text-sm"
          style={selectStyle}
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value as ComparisonSortField);
            setPage(1);
          }}
          aria-label="Sort by"
          className="h-9 rounded-lg border px-3 text-sm"
          style={selectStyle}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setSortOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
            setPage(1);
          }}
          title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
          aria-label={`Sort ${sortOrder === 'desc' ? 'descending' : 'ascending'}`}
          className="flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
          style={selectStyle}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortOrder === 'desc' ? 'Desc' : 'Asc'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          className="animate-fade-up flex items-start gap-3 rounded-xl p-4 text-sm"
          style={{
            background: 'var(--sl-red-light)',
            border: '1px solid var(--sl-red-muted)',
            color: 'var(--sl-red)',
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {error instanceof Error ? error.message : 'Failed to load comparisons. Please try again.'}
        </div>
      )}

      {/* Loading */}
      {!error && isLoading && (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="skeleton rounded-lg"
              style={{ height: '56px', animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {!error && !isLoading && comparisons.length === 0 && (
        <EmptyStateHelix
          title={isFiltered ? 'No matching comparisons' : 'No comparisons yet'}
          description={
            isFiltered
              ? 'Try a different search term, or clear the project filter.'
              : 'Comparisons appear here once a project has a processed differential expression analysis.'
          }
          action={
            isFiltered ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setProjectId('');
                }}
                className="mt-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--sl-purple)' }}
              >
                Clear filters
              </button>
            ) : (
              <Link
                href="/projects"
                className="mt-2 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--sl-purple)' }}
              >
                Go to projects
              </Link>
            )
          }
        />
      )}

      {/* Table */}
      {!error && !isLoading && comparisons.length > 0 && (
        <>
          <div
            className="overflow-x-auto rounded-xl"
            style={{ border: '1px solid var(--border-subtle)', opacity: isFetching ? 0.6 : 1 }}
          >
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-raised)' }}>
                  <Th>Comparison</Th>
                  <Th>Project</Th>
                  <Th align="right" className="hidden md:table-cell">
                    Up
                  </Th>
                  <Th align="right" className="hidden md:table-cell">
                    Down
                  </Th>
                  <Th align="right">Total</Th>
                  <Th>Enrichment</Th>
                  <Th align="right">Updated</Th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((item) => (
                  <tr
                    key={`${item.project_id}-${item.dataset_id}-${item.name}`}
                    className="transition-colors hover:bg-[var(--hover-overlay)]"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                  >
                    <Td>
                      <Link
                        href={comparisonHref(item)}
                        className="group flex items-center gap-2.5"
                      >
                        <GitCompareArrows
                          className="h-4 w-4 flex-shrink-0"
                          style={{ color: 'var(--sl-teal-dark)' }}
                        />
                        <span className="min-w-0">
                          <span
                            className="block truncate font-medium group-hover:underline"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.name}
                          </span>
                          <span
                            className="block truncate text-xs"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {item.dataset_name}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/projects/${item.project_id}`}
                        className="truncate hover:underline"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {item.project_name}
                      </Link>
                    </Td>
                    <Td align="right" className="hidden md:table-cell">
                      <span style={{ color: 'var(--sl-red)' }}>{item.deg_up}</span>
                    </Td>
                    <Td align="right" className="hidden md:table-cell">
                      <span style={{ color: 'var(--sl-teal-dark)' }}>{item.deg_down}</span>
                    </Td>
                    <Td align="right">
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {item.deg_total}
                      </span>
                    </Td>
                    <Td>
                      {item.has_enrichment ? (
                        <Badge variant="teal">Yes</Badge>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          —
                        </span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {relativeDate(item.updated_at)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {`${firstRow}–${lastRow} of ${total}`}
            </span>
            <div className="flex gap-2">
              <PagerButton onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                Previous
              </PagerButton>
              <PagerButton onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                Next
              </PagerButton>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function Th({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
      style={{ color: 'var(--text-muted)' }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <td
      className={`max-w-[240px] px-3 py-2.5 ${
        align === 'right' ? 'text-right' : 'text-left'
      } ${className}`}
    >
      {children}
    </td>
  );
}

function PagerButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      style={selectStyle}
    >
      {children}
    </button>
  );
}
