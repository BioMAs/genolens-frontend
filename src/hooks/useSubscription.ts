/**
 * React Query wrapper for the billing subscription endpoint.
 */
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { SubscriptionInfo } from './useBilling';

export function useSubscription() {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await api.get<SubscriptionInfo>('/billing/subscription');
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });
}
