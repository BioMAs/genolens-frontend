/**
 * Custom hooks for gene bookmarks and gene lists
 */
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import api from '@/utils/api';
import {
  GeneBookmark,
  GeneBookmarkCreate,
  GeneBookmarkUpdate,
  GeneList,
  GeneListCreate,
  GeneListUpdate,
  GeneListAddGenes,
  GeneListRemoveGenes,
  BookmarkBatchCreate,
  BookmarkBatchResponse,
} from '@/types/bookmark';

// ============================================================================
// Gene Bookmarks
// ============================================================================

/**
 * Hook to get user's gene bookmarks for a project
 */
export function useBookmarks(
  projectId: string,
  geneSymbol?: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['bookmarks', projectId, geneSymbol],
    queryFn: async () => {
      const params = geneSymbol ? { gene_symbol: geneSymbol } : {};
      const response = await api.get<GeneBookmark[]>(
        `/projects/${projectId}/bookmarks`,
        { params }
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!projectId && enabled,
  });
}

/**
 * Hook to check if a gene is bookmarked
 */
export function useIsBookmarked(
  projectId: string,
  geneSymbol: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['bookmark-check', projectId, geneSymbol],
    queryFn: async () => {
      const response = await api.get<{ is_bookmarked: boolean }>(
        `/projects/${projectId}/bookmarks/check/${geneSymbol}`
      );
      return response.data.is_bookmarked;
    },
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!projectId && !!geneSymbol && enabled,
  });
}

/**
 * Hook to create a gene bookmark
 */
export function useCreateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: GeneBookmarkCreate;
    }) => {
      const response = await api.post<GeneBookmark>(
        `/projects/${projectId}/bookmarks`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate bookmark lists
      queryClient.invalidateQueries({ queryKey: ['bookmarks', data.project_id] });
      // Invalidate check for this gene
      queryClient.invalidateQueries({
        queryKey: ['bookmark-check', data.project_id, data.gene_symbol],
      });
    },
  });
}

/**
 * Hook to create multiple bookmarks at once
 */
export function useCreateBookmarksBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: BookmarkBatchCreate;
    }) => {
      const response = await api.post<BookmarkBatchResponse>(
        `/projects/${projectId}/bookmarks/batch`,
        data
      );
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate all bookmark queries for this project
      queryClient.invalidateQueries({ queryKey: ['bookmarks', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['bookmark-check', variables.projectId] });
    },
  });
}

/**
 * Hook to update a bookmark
 */
export function useUpdateBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookmarkId,
      data,
    }: {
      bookmarkId: string;
      data: GeneBookmarkUpdate;
    }) => {
      const response = await api.put<GeneBookmark>(
        `/bookmarks/${bookmarkId}`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate bookmark lists
      queryClient.invalidateQueries({ queryKey: ['bookmarks', data.project_id] });
    },
  });
}

/**
 * Hook to delete a bookmark
 */
export function useDeleteBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bookmarkId: string) => {
      await api.delete(`/bookmarks/${bookmarkId}`);
    },
    onSuccess: (_, bookmarkId) => {
      // Invalidate all bookmark queries
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
      queryClient.invalidateQueries({ queryKey: ['bookmark-check'] });
    },
  });
}

// ============================================================================
// Gene Lists
// ============================================================================

/**
 * Hook to get user's gene lists for a project
 */
export function useGeneLists(
  projectId: string,
  includePublic: boolean = true,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['gene-lists', projectId, includePublic],
    queryFn: async () => {
      const response = await api.get<GeneList[]>(
        `/projects/${projectId}/gene-lists`,
        { params: { include_public: includePublic } }
      );
      return response.data;
    },
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
    enabled: !!projectId && enabled,
  });
}

/**
 * Hook to create a gene list
 */
export function useCreateGeneList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: GeneListCreate;
    }) => {
      const response = await api.post<GeneList>(
        `/projects/${projectId}/gene-lists`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate gene lists
      queryClient.invalidateQueries({ queryKey: ['gene-lists', data.project_id] });
    },
  });
}

/**
 * Hook to update a gene list
 */
export function useUpdateGeneList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      data,
    }: {
      listId: string;
      data: GeneListUpdate;
    }) => {
      const response = await api.put<GeneList>(`/gene-lists/${listId}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate gene lists
      queryClient.invalidateQueries({ queryKey: ['gene-lists', data.project_id] });
    },
  });
}

/**
 * Hook to add genes to a list
 */
export function useAddGenesToList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      data,
    }: {
      listId: string;
      data: GeneListAddGenes;
    }) => {
      const response = await api.post<GeneList>(
        `/gene-lists/${listId}/add-genes`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate gene lists
      queryClient.invalidateQueries({ queryKey: ['gene-lists', data.project_id] });
    },
  });
}

/**
 * Hook to remove genes from a list
 */
export function useRemoveGenesFromList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listId,
      data,
    }: {
      listId: string;
      data: GeneListRemoveGenes;
    }) => {
      const response = await api.post<GeneList>(
        `/gene-lists/${listId}/remove-genes`,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate gene lists
      queryClient.invalidateQueries({ queryKey: ['gene-lists', data.project_id] });
    },
  });
}

/**
 * Hook to delete a gene list
 */
export function useDeleteGeneList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      await api.delete(`/gene-lists/${listId}`);
    },
    onSuccess: () => {
      // Invalidate all gene lists
      queryClient.invalidateQueries({ queryKey: ['gene-lists'] });
    },
  });
}
