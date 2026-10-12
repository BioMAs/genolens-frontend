/**
 * React Query hooks for Project Members (Collaboration).
 *
 * All calls go through the shared `api` client, which attaches the Supabase
 * access token. These hooks used to call `fetch` with
 * `localStorage.getItem("token")` — a key nothing ever writes — so every request
 * went out as `Bearer null` and the backend answered 401.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/utils/api";
import {
  ProjectMemberCreate,
  ProjectMemberUpdate,
  ProjectMemberListResponse,
} from "@/types/project-member";

/** Same error message the callers already display: the backend `detail`. */
function toError(err: unknown, fallback: string): Error {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return new Error(typeof detail === "string" ? detail : fallback);
}

/**
 * Fetch all members of a project.
 */
export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMemberListResponse>({
    queryKey: ["projects", projectId, "members"],
    queryFn: async () => {
      try {
        const response = await api.get<ProjectMemberListResponse>(
          `/projects/${projectId}/members`
        );
        return response.data;
      } catch (err) {
        throw toError(err, "Failed to fetch project members");
      }
    },
    enabled: !!projectId,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Invite a user to a project.
 */
export function useInviteProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProjectMemberCreate) => {
      try {
        const response = await api.post(`/projects/${projectId}/members`, data);
        return response.data;
      } catch (err) {
        throw toError(err, "Failed to invite member");
      }
    },
    onSuccess: () => {
      // Invalidate project members list
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "members"],
      });
    },
  });
}

/**
 * Update a project member's role.
 */
export function useUpdateProjectMember(projectId: string, userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProjectMemberUpdate) => {
      try {
        const response = await api.patch(`/projects/${projectId}/members/${userId}`, data);
        return response.data;
      } catch (err) {
        throw toError(err, "Failed to update member");
      }
    },
    onSuccess: () => {
      // Invalidate project members list
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "members"],
      });
    },
  });
}

/**
 * Remove a member from a project.
 */
export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      try {
        await api.delete(`/projects/${projectId}/members/${userId}`);
      } catch (err) {
        throw toError(err, "Failed to remove member");
      }
    },
    onSuccess: () => {
      // Invalidate project members list
      queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "members"],
      });
    },
  });
}
