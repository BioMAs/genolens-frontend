/**
 * Hook for project dashboard statistics
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { ProjectDashboardStats } from '@/types/project-stats';

export function useProjectDashboardStats(projectId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['project-dashboard-stats', projectId],
    queryFn: async () => {
      const response = await api.get<ProjectDashboardStats>(
        `/projects/${projectId}/dashboard-stats`
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5,
    enabled: !!projectId && enabled,
  });
}
