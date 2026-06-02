import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export interface LicenseStatus {
  valid: boolean;
  expires_at: number | null;
  client_id: string | null;
  plan: string | null;
  error: string | null;
}

export function useLicenseStatus() {
  return useQuery<LicenseStatus>({
    queryKey: ['license-status'],
    queryFn: () => api.get('/license/status').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });
}
