/**
 * React Query hook for Gene Search.
 */
import { useQuery } from "@tanstack/react-query";
import api from "@/utils/api";
import { GeneSearchResponse } from "@/types/gene-search";

export interface UseGeneSearchParams {
  query: string;
  projectId?: string;
  limit?: number;
  enabled?: boolean;
}

export function useGeneSearch({
  query,
  projectId,
  limit = 20,
  enabled = true,
}: UseGeneSearchParams) {
  return useQuery<GeneSearchResponse>({
    queryKey: ["genes", "search", query, projectId, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("q", query);
      if (projectId) params.append("project_id", projectId);
      params.append("limit", limit.toString());

      const response = await api.get<GeneSearchResponse>(
        `/genes/search?${params.toString()}`
      );
      return response.data;
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
