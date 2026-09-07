'use client';

import { useQuery } from '@tanstack/react-query';

import api from '@/utils/api';
import type { PricingGrid } from '@/types/pricing';

/** One cache key for the grid, app-wide. */
export const PRICING_QUERY_KEY = ['pricing'] as const;

/**
 * The pricing grid, served by the backend from `app/data/pricing.json`.
 *
 * Public endpoint: it resolves for anonymous visitors too, which is what lets
 * the pricing page render before sign-in. The grid only changes on deploy, so
 * it is cached hard and never refetched on focus — the backend also answers
 * `304` on a matching `ETag`.
 */
export function usePricing() {
  return useQuery<PricingGrid>({
    queryKey: PRICING_QUERY_KEY,
    queryFn: async () => {
      const res = await api.get<PricingGrid>('/pricing');
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // 1 h
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
