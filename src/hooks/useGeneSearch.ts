/**
 * React Query hook for Gene Search.
 */
import { useQuery } from "@tanstack/react-query";
import { GeneSearchResponse } from "@/types/gene-search";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface UseGeneSearchParams {
  query: string;
  projectId?: string;
  limit?: number;
  enabled?: boolean;
}

/**
 * Search for genes across all user's projects.
 * 
 * @param query - Gene symbol or ID to search for
 * @param projectId - Optional project ID to limit search scope
 * @param limit - Maximum number of results (default 20)
 * @param enabled - Whether the query should run (default: true if query is not empty)
 */
export function useGeneSearch({
  query,
  projectId,
  limit = 20,
  enabled = true,
}: UseGeneSearchParams) {
  return useQuery<GeneSearchResponse>({
    queryKey: ["genes", "search", query, projectId, limit],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      
      params.append("q", query);
      if (projectId) params.append("project_id", projectId);
      params.append("limit", limit.toString());

      const response = await fetch(
        `${API_BASE}/genes/search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to search genes");
      }

      return response.json();
    },
    enabled: enabled && query.trim().length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
