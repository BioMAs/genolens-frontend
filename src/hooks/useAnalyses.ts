import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import {
  SelfServiceAnalysis,
  SelfServiceAnalysisCreate,
  SelfServiceAnalysisListResponse,
  SelfServiceAnalysisStatus,
} from '@/types';

const POLL_INTERVAL = 5_000; // ms — poll every 5 s when job is active

const isActive = (status: SelfServiceAnalysisStatus) =>
  status === SelfServiceAnalysisStatus.PENDING ||
  status === SelfServiceAnalysisStatus.RUNNING;

// ---------------------------------------------------------------------------
// useAnalyses — list all analyses for a project (auto-polls when active)
// ---------------------------------------------------------------------------

export function useAnalyses(projectId: string, enabled = true) {
  return useQuery<SelfServiceAnalysisListResponse>({
    queryKey: ['analyses', projectId],
    queryFn: async () => {
      const res = await api.get<SelfServiceAnalysisListResponse>('/analyses', {
        params: { project_id: projectId },
      });
      return res.data;
    },
    staleTime: 1_000 * 30, // 30 s
    gcTime: 1_000 * 60 * 5,
    enabled: !!projectId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.items.some((a) => isActive(a.status));
      return hasActive ? POLL_INTERVAL : false;
    },
  });
}

// ---------------------------------------------------------------------------
// useAnalysis — single analysis (auto-polls when active)
// ---------------------------------------------------------------------------

export function useAnalysis(analysisId: string, enabled = true) {
  return useQuery<SelfServiceAnalysis>({
    queryKey: ['analysis', analysisId],
    queryFn: async () => {
      const res = await api.get<SelfServiceAnalysis>(`/analyses/${analysisId}`);
      return res.data;
    },
    staleTime: 1_000 * 15,
    gcTime: 1_000 * 60 * 5,
    enabled: !!analysisId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      return isActive(data.status) ? POLL_INTERVAL : false;
    },
  });
}

// ---------------------------------------------------------------------------
// useCreateAnalysis — POST /analyses mutation
// ---------------------------------------------------------------------------

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation<SelfServiceAnalysis, Error, SelfServiceAnalysisCreate>({
    mutationFn: async (payload) => {
      const res = await api.post<SelfServiceAnalysis>('/analyses', payload);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['analyses', data.project_id] });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteAnalysis — DELETE /analyses/{id} mutation
// ---------------------------------------------------------------------------

export function useDeleteAnalysis(projectId: string) {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (analysisId) => {
      await api.delete(`/analyses/${analysisId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analyses', projectId] });
    },
  });
}

export function useAnnoDbCategories(species: string, enabled = true) {
  return useQuery<{ species: string; categories: string[] }>({
    queryKey: ['anno-db-categories', species],
    queryFn: async () => {
      const res = await api.get('/analyses/anno-db-categories', { params: { species } });
      return res.data;
    },
    staleTime: 1000 * 60 * 30, // 30 min — categories rarely change
    enabled: !!species && enabled,
  });
}
