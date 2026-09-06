import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import type { ComparisonSummary } from './useProjectData';

/**
 * A comparison seen from the workspace rather than from inside its project:
 * same shape as the project-scoped summary, plus where it comes from.
 */
export interface UserComparisonItem extends ComparisonSummary {
  project_id: string;
  project_name: string;
  dataset_name: string;
  updated_at: string | null;
}

export interface PaginatedUserComparisonsResponse {
  comparisons: UserComparisonItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type ComparisonSortField = 'name' | 'project_name' | 'deg_total' | 'updated_at';

export interface AllComparisonFilters {
  page?: number;
  page_size?: number;
  search?: string;
  project_id?: string;
  sort_by?: ComparisonSortField;
  sort_order?: 'asc' | 'desc';
}

/**
 * Every comparison the current user can reach, across all their projects.
 * Backed by GET /comparisons — the only cross-project listing in the API.
 */
export function useAllComparisons(filters: AllComparisonFilters = {}) {
  return useQuery({
    queryKey: ['comparisons', 'all', filters],
    queryFn: async () => {
      const response = await api.get<PaginatedUserComparisonsResponse>('/comparisons', {
        params: filters,
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes, aligned with useProjectComparisons
    placeholderData: (previous) => previous, // keep rows on screen while paging
  });
}
