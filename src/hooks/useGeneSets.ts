'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';

export interface CustomGeneSet {
  id: string;
  name: string;
  description?: string | null;
  size: number;
  genes: string[];
  database: string;
}

const keyFor = (projectId: string) => ['custom-gene-sets', projectId];

export function useCustomGeneSets(projectId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: keyFor(projectId),
    queryFn: async () => {
      const resp = await api.get<CustomGeneSet[]>(`/projects/${projectId}/gene-sets`);
      return resp.data;
    },
    staleTime: 1000 * 60,
    enabled: !!projectId && enabled,
  });
}

export function useCreateCustomGeneSet(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; genes: string[]; description?: string }) => {
      const resp = await api.post(`/projects/${projectId}/gene-sets`, data);
      return resp.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(projectId) }),
  });
}

export function useUploadGmt(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const resp = await api.post(`/projects/${projectId}/gene-sets/upload-gmt`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return resp.data as { created: number; updated: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(projectId) }),
  });
}

export function useDeleteCustomGeneSet(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (geneSetId: string) => {
      await api.delete(`/projects/${projectId}/gene-sets/${geneSetId}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keyFor(projectId) }),
  });
}
