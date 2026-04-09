/**
 * React Query hooks for comments API
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import type {
  ProjectComment,
  ProjectCommentCreate,
  ProjectCommentUpdate,
  CommentType,
  CommentCount
} from '@/types/comment';

// ============================================================================
// Query Keys
// ============================================================================

export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (projectId: string, filters?: Record<string, any>) =>
    [...commentKeys.lists(), projectId, filters] as const,
  detail: (commentId: string) => [...commentKeys.all, 'detail', commentId] as const,
  thread: (commentId: string) => [...commentKeys.all, 'thread', commentId] as const,
  count: (projectId: string, targetId?: string) =>
    [...commentKeys.all, 'count', projectId, targetId] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Get comments for a project
 */
export function useComments(
  projectId: string,
  commentType?: CommentType,
  targetId?: string,
  includeResolved: boolean = true
) {
  return useQuery({
    queryKey: commentKeys.list(projectId, { commentType, targetId, includeResolved }),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (commentType) params.append('comment_type', commentType);
      if (targetId) params.append('target_id', targetId);
      params.append('include_resolved', String(includeResolved));

      const response = await api.get(
        `/projects/${projectId}/comments?${params.toString()}`
      );
      return response.data as ProjectComment[];
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single comment by ID
 */
export function useComment(commentId?: string) {
  return useQuery({
    queryKey: commentKeys.detail(commentId!),
    queryFn: async () => {
      const response = await api.get(`/comments/${commentId}`);
      return response.data as ProjectComment;
    },
    enabled: !!commentId,
  });
}

/**
 * Get comment thread (comment + all replies)
 */
export function useCommentThread(commentId?: string) {
  return useQuery({
    queryKey: commentKeys.thread(commentId!),
    queryFn: async () => {
      const response = await api.get(`/comments/${commentId}/thread`);
      return response.data;
    },
    enabled: !!commentId,
  });
}

/**
 * Get comment count
 */
export function useCommentCount(projectId: string, targetId?: string) {
  return useQuery({
    queryKey: commentKeys.count(projectId, targetId),
    queryFn: async () => {
      const params = targetId ? `?target_id=${targetId}` : '';
      const response = await api.get(
        `/projects/${projectId}/comments/count${params}`
      );
      return response.data as CommentCount;
    },
    enabled: !!projectId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Create a new comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      data,
    }: {
      projectId: string;
      data: ProjectCommentCreate;
    }) => {
      const response = await api.post(`/projects/${projectId}/comments`, data);
      return response.data as ProjectComment;
    },
    onSuccess: (_, variables) => {
      // Invalidate comments list
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: commentKeys.count(variables.projectId),
      });
      
      // If it's a reply, invalidate parent thread
      if (variables.data.parent_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.thread(variables.data.parent_id),
        });
      }
    },
  });
}

/**
 * Update a comment
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      data,
    }: {
      commentId: string;
      data: ProjectCommentUpdate;
    }) => {
      const response = await api.patch(`/comments/${commentId}`, data);
      return response.data as ProjectComment;
    },
    onSuccess: (data) => {
      // Invalidate specific comment and lists
      queryClient.invalidateQueries({ queryKey: commentKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: commentKeys.lists() });
      
      // If it has a parent, invalidate thread
      if (data.parent_id) {
        queryClient.invalidateQueries({
          queryKey: commentKeys.thread(data.parent_id),
        });
      }
    },
  });
}

/**
 * Delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete(`/comments/${commentId}`);
    },
    onSuccess: () => {
      // Invalidate all comment queries
      queryClient.invalidateQueries({ queryKey: commentKeys.all });
    },
  });
}

/**
 * Toggle comment resolved status
 */
export function useToggleCommentResolved() {
  const updateComment = useUpdateComment();

  return {
    mutate: (commentId: string, isResolved: boolean) => {
      updateComment.mutate({
        commentId,
        data: { is_resolved: isResolved },
      });
    },
    isPending: updateComment.isPending,
    isError: updateComment.isError,
    error: updateComment.error,
  };
}
