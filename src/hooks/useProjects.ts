import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/utils/api';
import { Project, ProjectListResponse } from '@/types';

/**
 * Interface pour les filtres de liste de projets
 */
export interface ProjectFilters {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: 'created_at' | 'updated_at' | 'name';
  sort_order?: 'asc' | 'desc';
}

/**
 * Hook pour récupérer la liste de tous les projets avec pagination optionnelle
 */
export function useProjects(filters: ProjectFilters = {}, enabled: boolean = true) {
  return useQuery({
    queryKey: ['projects', filters],
    queryFn: async () => {
      const response = await api.get<ProjectListResponse>('/projects/', {
        params: filters,
      });
      return response.data;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - projets changent occasionnellement
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled,
  });
}

/**
 * Hook pour récupérer un projet spécifique par ID
 * Déjà disponible dans useProjectData.ts mais redéfini ici pour cohérence
 */
export function useProject(projectId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const response = await api.get<Project>(`/projects/${projectId}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!projectId && enabled,
  });
}

/**
 * Hook pour créer un nouveau projet
 * Invalide automatiquement le cache de la liste des projets
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectData: { name: string; description?: string }) => {
      const response = await api.post<Project>('/projects/', projectData);
      return response.data;
    },
    onSuccess: () => {
      // Invalide le cache de la liste des projets pour forcer un refresh
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Hook pour mettre à jour un projet
 * Invalide automatiquement le cache du projet et de la liste
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { name?: string; description?: string };
    }) => {
      const response = await api.put<Project>(`/projects/${projectId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalide le cache du projet spécifique
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      // Invalide aussi la liste des projets
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Hook pour supprimer un projet
 * Invalide automatiquement le cache de la liste des projets
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      await api.delete(`/projects/${projectId}`);
      return projectId;
    },
    onSuccess: (projectId) => {
      // Supprime le projet du cache
      queryClient.removeQueries({ queryKey: ['project', projectId] });
      // Invalide la liste des projets
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

/**
 * Hook utilitaire pour précharger un projet au survol
 */
export function usePrefetchProject() {
  const queryClient = useQueryClient();

  return {
    prefetchProject: (projectId: string) => {
      queryClient.prefetchQuery({
        queryKey: ['project', projectId],
        queryFn: async () => {
          const response = await api.get<Project>(`/projects/${projectId}`);
          return response.data;
        },
        staleTime: 1000 * 60 * 5,
      });
    },
  };
}
