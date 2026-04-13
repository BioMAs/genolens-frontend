import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { LoginStatsResponse } from '@/types';

export function useLoginStats(days: number = 30) {
  return useQuery({
    queryKey: ['admin', 'login-stats', days],
    queryFn: async () => {
      const response = await api.get<LoginStatsResponse>('/admin/login-stats', {
        params: { days },
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}
