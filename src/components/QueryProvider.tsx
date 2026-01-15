'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

export default function QueryProvider({ children }: { children: ReactNode }) {
  // Create a client per render to avoid sharing state between users in SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes - data considered fresh
            gcTime: 1000 * 60 * 5, // 5 minutes - cache time
            refetchOnWindowFocus: false, // Don't refetch on window focus
            refetchOnMount: false, // Don't refetch on component mount if data exists
            retry: 1, // Only retry failed requests once
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only show in development */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
