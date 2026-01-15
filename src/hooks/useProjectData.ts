import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { Project, Dataset } from '@/types';

export interface ComparisonSummary {
  name: string;
  deg_up: number;
  deg_down: number;
  deg_total: number;
  has_enrichment: boolean;
  dataset_id: string;
  dataset_type: 'SINGLE' | 'GLOBAL';
}

export interface ProjectStats {
  total_datasets: number;
  total_comparisons: number;
  processing_count: number;
  ready_count: number;
  failed_count: number;
  original_files_count: number;
}

export interface ProjectSummary {
  project: Project;
  stats: ProjectStats;
  comparisons: ComparisonSummary[];
  original_files: string[];
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get<Project>(`/projects/${projectId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!projectId,
  });
}

export function useProjectSummary(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId, 'summary'],
    queryFn: async () => {
      const response = await api.get<ProjectSummary>(`/projects/${projectId}/summary`);
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: (query) => {
      // Smart refetch: only poll if there are processing datasets
      const summary = query.state.data;
      if ((summary?.stats.processing_count ?? 0) > 0) {
        return 10000; // Poll every 10 seconds
      }
      return false; // Don't poll
    },
    enabled: !!projectId,
  });
}

export function useProjectDatasets(projectId: string, page: number = 1, pageSize: number = 100) {
  return useQuery({
    queryKey: ['datasets', 'project', projectId, page, pageSize],
    queryFn: async () => {
      const response = await api.get<Dataset[]>(`/datasets/project/${projectId}`, {
        params: { page, page_size: pageSize }
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: (query) => {
      // Smart refetch: only poll if there are processing datasets
      const datasets = query.state.data;
      if (datasets?.some(d => d.status === 'PROCESSING')) {
        return 10000; // Poll every 10 seconds
      }
      return false; // Don't poll
    },
    enabled: !!projectId,
  });
}

export function useDatasetQuery(datasetId: string, limit: number = 500) {
  return useQuery({
    queryKey: ['dataset', datasetId, 'query', limit],
    queryFn: async () => {
      const response = await api.post(`/datasets/${datasetId}/query`, { limit });
      return response.data;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - dataset data rarely changes
    enabled: !!datasetId,
  });
}
