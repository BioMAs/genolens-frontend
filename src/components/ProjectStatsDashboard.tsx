'use client';

import {
  Database,
  GitCompare,
  BarChart2,
  Bookmark,
  MessageSquare,
  Users,
  TrendingUp,
  List,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useProjectDashboardStats } from '@/hooks/useProjectDashboardStats';
import { ProjectDashboardStats as StatsType } from '@/types/project-stats';

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD} j`;
}

// ============================================================================
// Sub-components
// ============================================================================

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  iconBg?: string;
  iconColor?: string;
  subtitle?: string;
}

function StatCard({ icon: Icon, label, value, iconBg = 'bg-indigo-50', iconColor = 'text-indigo-600', subtitle }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 truncate">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold text-gray-900 leading-none tabular-nums">
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </p>
        {subtitle && <p className="mt-1 text-xs text-gray-400 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

function DatasetStatusBar({ stats }: { stats: StatsType }) {
  const total = stats.total_datasets;
  if (total === 0) return null;
  const readyPct = Math.round((stats.datasets_ready / total) * 100);
  const processingPct = Math.round((stats.datasets_processing / total) * 100);
  const failedPct = Math.round((stats.datasets_failed / total) * 100);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
        Datasets par statut
      </p>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        {readyPct > 0 && (
          <div className="bg-emerald-500" style={{ width: `${readyPct}%` }} title={`Prêts: ${stats.datasets_ready}`} />
        )}
        {processingPct > 0 && (
          <div className="bg-blue-400" style={{ width: `${processingPct}%` }} title={`En traitement: ${stats.datasets_processing}`} />
        )}
        {failedPct > 0 && (
          <div className="bg-red-400" style={{ width: `${failedPct}%` }} title={`Erreur: ${stats.datasets_failed}`} />
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" />
          {stats.datasets_ready} prêt{stats.datasets_ready > 1 ? 's' : ''}
        </span>
        {stats.datasets_processing > 0 && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 text-blue-400" />
            {stats.datasets_processing} en cours
          </span>
        )}
        {stats.datasets_failed > 0 && (
          <span className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3 text-red-400" />
            {stats.datasets_failed} erreur{stats.datasets_failed > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function ActivityWeekCard({ stats }: { stats: StatsType }) {
  const a = stats.activity_last_7_days;
  const items = [
    { label: 'Datasets', value: a.datasets_uploaded, color: 'bg-blue-500' },
    { label: 'Bookmarks', value: a.bookmarks_created, color: 'bg-yellow-500' },
    { label: 'Commentaires', value: a.comments_added, color: 'bg-pink-500' },
    { label: 'Analyses', value: a.analyses_run, color: 'bg-purple-500' },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">
        Activité (7 derniers jours) — {total} événements
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-xs text-gray-600">{item.label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-100">
              {total > 0 && item.value > 0 && (
                <div
                  className={`h-1.5 rounded-full ${item.color}`}
                  style={{ width: `${Math.round((item.value / total) * 100)}%` }}
                />
              )}
            </div>
            <span className="w-5 text-right text-xs font-medium text-gray-700 tabular-nums">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

interface ProjectStatsDashboardProps {
  projectId: string;
}

export default function ProjectStatsDashboard({ projectId }: ProjectStatsDashboardProps) {
  const { data: stats, isLoading, isError } = useProjectDashboardStats(projectId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
        Impossible de charger les statistiques du projet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Last activity & total events */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5" />
          Dernière activité : <span className="font-medium text-gray-700">{formatRelativeDate(stats.last_activity_at)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Activity className="h-3.5 w-3.5" />
          <span className="font-medium text-gray-700">{stats.total_activity_events.toLocaleString('fr-FR')}</span> événements au total
        </div>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={Database}
          label="Datasets"
          value={stats.total_datasets}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          subtitle={`${stats.dataset_breakdown.matrix} matrix · ${stats.dataset_breakdown.deg} DEG`}
        />
        <StatCard
          icon={GitCompare}
          label="Comparaisons"
          value={stats.total_comparisons}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Gènes DEG"
          value={stats.total_deg_genes}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        />
        <StatCard
          icon={BarChart2}
          label="Pathways enrichis"
          value={stats.total_enrichment_pathways}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        />
        <StatCard
          icon={Bookmark}
          label="Bookmarks"
          value={stats.total_bookmarks}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-600"
        />
        <StatCard
          icon={List}
          label="Listes de gènes"
          value={stats.total_gene_lists}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
        />
        <StatCard
          icon={MessageSquare}
          label="Commentaires"
          value={stats.total_comments}
          iconBg="bg-pink-50"
          iconColor="text-pink-600"
        />
        <StatCard
          icon={Users}
          label="Membres"
          value={stats.total_members}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
        />
      </div>

      {/* Dataset status + 7-day activity */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <DatasetStatusBar stats={stats} />
        <ActivityWeekCard stats={stats} />
      </div>
    </div>
  );
}
