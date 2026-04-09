/**
 * Custom hook for project activity history
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { ActivityEventType, ActivityLogListResponse } from '@/types/history';

export function useProjectHistory(
  projectId: string,
  options?: {
    limit?: number;
    offset?: number;
    eventType?: ActivityEventType;
    enabled?: boolean;
  }
) {
  const { limit = 50, offset = 0, eventType, enabled = true } = options ?? {};

  return useQuery({
    queryKey: ['project-history', projectId, limit, offset, eventType],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit, offset };
      if (eventType) params.event_type = eventType;
      const response = await api.get<ActivityLogListResponse>(
        `/projects/${projectId}/history`,
        { params }
      );
      return response.data;
    },
    staleTime: 1000 * 30, // 30 seconds — history updates frequently
    gcTime: 1000 * 60 * 2,
    enabled: !!projectId && enabled,
  });
}
