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
  dataset_deleted: { icon: Trash2, label: 'Dataset deleted', color: 'bg-red-100', textColor: 'text-red-600' },
  comparison_created: { icon: GitCompare, label: 'Comparison created', color: 'bg-purple-100', textColor: 'text-purple-600' },
  enrichment_run: { icon: BarChart2, label: 'Enrichment analysis', color: 'bg-orange-100', textColor: 'text-orange-600' },
  clustering_run: { icon: Network, label: 'Clustering analysis', color: 'bg-teal-100', textColor: 'text-teal-600' },
  gsea_run: { icon: TrendingUp, label: 'GSEA run', color: 'bg-indigo-100', textColor: 'text-indigo-600' },
  go_enrichment_run: { icon: Leaf, label: 'GO enrichment run', color: 'bg-green-100', textColor: 'text-green-600' },
  bookmark_created: { icon: Bookmark, label: 'Gene bookmarked', color: 'bg-yellow-100', textColor: 'text-yellow-600' },
  bookmark_batch_created: { icon: BookmarkPlus, label: 'Batch bookmarks created', color: 'bg-yellow-100', textColor: 'text-yellow-700' },
  bookmark_deleted: { icon: Trash2, label: 'Bookmark removed', color: 'bg-gray-100', textColor: 'text-gray-500' },
  gene_list_created: { icon: List, label: 'Gene list created', color: 'bg-cyan-100', textColor: 'text-cyan-600' },
  comment_added: { icon: MessageSquare, label: 'Comment added', color: 'bg-pink-100', textColor: 'text-pink-600' },
  project_shared: { icon: Share2, label: 'Project shared', color: 'bg-violet-100', textColor: 'text-violet-600' },
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
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
    return `${base} (${created} créé(s), ${skipped} ignoré(s))`;
  }

  return base;
}

// ============================================================================
// Sub-components
// ============================================================================

function EventIcon({ eventType }: { eventType: ActivityEventType }) {
  const meta = EVENT_META[eventType] ?? {
    icon: Clock,
    color: 'bg-gray-100',
    textColor: 'text-gray-500',
  };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${meta.color}`}>
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
      <div className="absolute left-[18px] top-[36px] bottom-0 w-px bg-gray-200" aria-hidden="true" />

      {/* Icon */}
      <div className="relative mt-1 flex-shrink-0">
        <EventIcon eventType={entry.event_type} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm font-medium text-gray-900 truncate">
          {buildDescription(entry)}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{formatDate(entry.created_at)}</p>

        {hasExtra && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Masquer les détails' : 'Voir les détails'}
          </button>
        )}

        {expanded && hasExtra && (
          <pre className="mt-2 rounded bg-gray-50 border border-gray-100 p-2 text-xs text-gray-600 overflow-x-auto">
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
    { value: '', label: 'Tous les événements' },
    { value: 'dataset_uploaded', label: 'Datasets' },
    { value: 'comparison_created', label: 'Comparaisons' },
    { value: 'enrichment_run', label: 'Enrichissement' },
    { value: 'clustering_run', label: 'Clustering' },
    { value: 'gsea_run', label: 'GSEA' },
    { value: 'go_enrichment_run', label: 'GO Enrichissement' },
    { value: 'bookmark_created', label: 'Bookmarks' },
    { value: 'comment_added', label: 'Commentaires' },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Historique du projet</h2>
          <p className="mt-1 text-sm text-gray-500">
            {total > 0 ? `${total} événement${total > 1 ? 's' : ''} enregistré${total > 1 ? 's' : ''}` : 'Aucun événement pour l\'instant'}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select
          value={eventTypeFilter ?? ''}
          onChange={(e) => {
            setEventTypeFilter((e.target.value as ActivityEventType) || undefined);
            setPage(0);
          }}
          className="block rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              <div className="h-9 w-9 flex-shrink-0 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1.5 py-1">
                <div className="h-3.5 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Impossible de charger l&apos;historique. Veuillez réessayer.
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500">
          <Clock className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          Aucun événement enregistré pour le moment.
        </div>
      ) : (
        <ul className="space-y-5">
          {items.map((entry) => (
            <TimelineEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrev}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Précédent
          </button>
          <span className="text-xs text-gray-500">
            Page {page + 1} / {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}
