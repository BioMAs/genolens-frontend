import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
      gcTime: 1000 * 60 * 5, // 5 minutes - cache time (formerly cacheTime)
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnMount: false, // Don't refetch on component mount if data exists
      retry: 1, // Only retry failed requests once
    },
  },
});
