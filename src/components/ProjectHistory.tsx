'use client';

import { useState } from 'react';
import {
  Upload,
  Trash2,
  GitCompare,
  BarChart2,
  Network,
  TrendingUp,
  Leaf,
  Bookmark,
  BookmarkPlus,
  List,
  MessageSquare,
  Share2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { useProjectHistory } from '@/hooks/useProjectHistory';
import { ActivityEventType, ActivityLogEntry } from '@/types/history';

// ============================================================================
// Event type metadata (icon + label + color)
// ============================================================================

interface EventMeta {
  icon: React.ElementType;
  label: string;
  color: string;       // Tailwind bg color class for the icon circle
  textColor: string;   // Tailwind text color class
}

const EVENT_META: Record<ActivityEventType, EventMeta> = {
  dataset_uploaded: { icon: Upload, label: 'Dataset uploaded', color: 'bg-blue-100', textColor: 'text-blue-600' },
  dataset_deleted: { icon: Trash2, label: 'Dataset deleted', color: 'bg-danger-soft', textColor: 'text-danger-ink' },
  comparison_created: { icon: GitCompare, label: 'Comparison created', color: 'bg-purple-100', textColor: 'text-purple-600' },
  enrichment_run: { icon: BarChart2, label: 'Enrichment analysis', color: 'bg-warning-soft', textColor: 'text-warning-ink' },
  clustering_run: { icon: Network, label: 'Clustering analysis', color: 'bg-teal-100', textColor: 'text-teal-600' },
  gsea_run: { icon: TrendingUp, label: 'GSEA run', color: 'bg-indigo-100', textColor: 'text-indigo-600' },
  go_enrichment_run: { icon: Leaf, label: 'GO enrichment run', color: 'bg-success-soft', textColor: 'text-success-ink' },
  bookmark_created: { icon: Bookmark, label: 'Gene bookmarked', color: 'bg-warning-soft', textColor: 'text-warning-ink' },
  bookmark_batch_created: { icon: BookmarkPlus, label: 'Batch bookmarks created', color: 'bg-warning-soft', textColor: 'text-warning-ink' },
  bookmark_deleted: { icon: Trash2, label: 'Bookmark removed', color: 'bg-surface-2', textColor: 'text-muted' },
  gene_list_created: { icon: List, label: 'Gene list created', color: 'bg-cyan-100', textColor: 'text-cyan-600' },
  comment_added: { icon: MessageSquare, label: 'Comment added', color: 'bg-pink-100', textColor: 'text-pink-600' },
  project_shared: { icon: Share2, label: 'Project shared', color: 'bg-violet-100', textColor: 'text-violet-600' },
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function buildDescription(entry: ActivityLogEntry): string {
  const meta = EVENT_META[entry.event_type];
  const base = meta?.label ?? entry.event_type;

  if (entry.entity_name) return `${base} — ${entry.entity_name}`;

  if (entry.event_type === 'bookmark_batch_created') {
    const created = entry.extra_metadata?.created ?? 0;
    const skipped = entry.extra_metadata?.skipped ?? 0;
    return `${base} (${created} created, ${skipped} skipped)`;
  }

  return base;
}

// ============================================================================
// Sub-components
// ============================================================================

function EventIcon({ eventType }: { eventType: ActivityEventType }) {
  const meta = EVENT_META[eventType] ?? {
    icon: Clock,
    color: 'bg-surface-2',
    textColor: 'text-muted',
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-pill ${meta.color}`}>
      <Icon className={`h-4 w-4 ${meta.textColor}`} aria-hidden="true" />
    </span>
  );
}

function TimelineEntry({ entry }: { entry: ActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = Object.keys(entry.extra_metadata ?? {}).length > 0;

  return (
    <li className="relative flex gap-x-4">
      {/* Vertical connector line */}
      <div className="absolute left-[18px] top-[36px] bottom-0 w-px bg-hover" aria-hidden="true" />

      {/* Icon */}
      <div className="relative mt-1 flex-shrink-0">
        <EventIcon eventType={entry.event_type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <p className="text-body-sm font-medium text-primary truncate">
          {buildDescription(entry)}
        </p>
        <p className="mt-1 text-caption text-secondary">{formatDate(entry.created_at)}</p>

        {hasExtra && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-caption text-muted hover:text-secondary transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide details' : 'View details'}
          </button>
        )}

        {expanded && hasExtra && (
          <pre className="mt-2 rounded-sm bg-surface-2 border border-subtle p-2 text-caption text-secondary overflow-x-auto">
            {JSON.stringify(entry.extra_metadata, null, 2)}
          </pre>
        )}
      </div>
    </li>
  );
}

// ============================================================================
// Main component
// ============================================================================

interface ProjectHistoryProps {
  projectId: string;
}

export default function ProjectHistory({ projectId }: ProjectHistoryProps) {
  const [eventTypeFilter, setEventTypeFilter] = useState<ActivityEventType | undefined>();
  const [page, setPage] = useState(0);
  const limit = 30;

  const { data, isLoading, isError, refetch, isFetching } = useProjectHistory(projectId, {
    limit,
    offset: page * limit,
    eventType: eventTypeFilter,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasNext = (page + 1) * limit < total;
  const hasPrev = page > 0;

  const filterOptions: Array<{ value: ActivityEventType | ''; label: string }> = [
    { value: '', label: 'All events' },
    { value: 'dataset_uploaded', label: 'Datasets' },
    { value: 'comparison_created', label: 'Comparisons' },
    { value: 'enrichment_run', label: 'Enrichment' },
    { value: 'clustering_run', label: 'Clustering' },
    { value: 'gsea_run', label: 'GSEA' },
    { value: 'go_enrichment_run', label: 'GO Enrichment' },
    { value: 'bookmark_created', label: 'Bookmarks' },
    { value: 'comment_added', label: 'Comments' },
  ];

  return (
    <div className="rounded-card bg-surface p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-title text-primary">Project history</h2>
          <p className="mt-1 text-body-sm text-secondary">
            {total > 0 ? `${total} event${total > 1 ? 's' : ''} recorded` : 'No events yet'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-sm border border-strong bg-surface px-3 py-1.5 text-body-sm text-primary hover:bg-hover disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          value={eventTypeFilter ?? ''}
          onChange={(e) => {
            setEventTypeFilter((e.target.value as ActivityEventType) || undefined);
            setPage(0);
          }}
          className="block rounded-sm border border-strong bg-surface px-3 py-1.5 text-body-sm text-primary shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 animate-pulse">
              <div className="h-9 w-9 flex-shrink-0 rounded-pill bg-hover" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-3/4 rounded-sm bg-hover" />
                <div className="h-3 w-1/2 rounded-sm bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-sm bg-danger-soft p-4 text-body-sm text-danger-ink">
          Failed to load history. Please try again.
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-body-sm text-secondary">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted" />
          No events recorded yet.
        </div>
      ) : (
        <ul className="space-y-6">
          {items.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex items-center justify-between border-t border-subtle pt-4">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="rounded-sm border border-strong px-3 py-1.5 text-body-sm text-primary hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-caption text-secondary">
            Page {page + 1} / {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="rounded-sm border border-strong px-3 py-1.5 text-body-sm text-primary hover:bg-hover disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
