/**
 * Hook to aggregate dashboard statistics across all user projects.
 * Accepts the project list from the parent to share the React Query cache.
 * Uses useQueries so each project's stats are fetched in parallel and
 * stored under ['project-dashboard-stats', projectId] — the same key used
 * by useProjectDashboardStats — enabling instant cache hits for project cards.
 */
import { useQueries } from '@tanstack/react-query';
import api from '@/utils/api';
import { Project } from '@/types';
import { ProjectDashboardStats } from '@/types/project-stats';

export interface AggregatedStats {
  total_projects: number;
  total_datasets: number;
  total_comparisons: number;
  total_deg_genes: number;
  total_enrichment_pathways: number;
  activity_last_7_days: number;
}

export function useUserDashboardStats(projects: Project[]) {
  const statsQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['project-dashboard-stats', p.id] as const,
      queryFn: async (): Promise<ProjectDashboardStats> => {
        const res = await api.get<ProjectDashboardStats>(`/projects/${p.id}/dashboard-stats`);
        return res.data;
      },
      staleTime: 1000 * 60,
      gcTime: 1000 * 60 * 5,
      enabled: !!p.id,
    })),
  });

  const isLoading = statsQueries.some((q) => q.isLoading);

  const statsMap: Record<string, ProjectDashboardStats> = {};
  const aggregated: AggregatedStats = {
    total_projects: projects.length,
    total_datasets: 0,
    total_comparisons: 0,
    total_deg_genes: 0,
    total_enrichment_pathways: 0,
    activity_last_7_days: 0,
  };

  statsQueries.forEach((q, i) => {
    if (q.data) {
      const pid = projects[i]?.id;
      if (pid) statsMap[pid] = q.data;
      aggregated.total_datasets += q.data.total_datasets;
      aggregated.total_comparisons += q.data.total_comparisons;
      aggregated.total_deg_genes += q.data.total_deg_genes;
      aggregated.total_enrichment_pathways += q.data.total_enrichment_pathways;
      const act = q.data.activity_last_7_days;
      aggregated.activity_last_7_days +=
        (act?.datasets_uploaded ?? 0) +
        (act?.bookmarks_created ?? 0) +
        (act?.comments_added ?? 0) +
        (act?.analyses_run ?? 0);
    }
  });

  return { aggregated, statsMap, isLoading };
}
