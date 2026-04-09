/**
 * React Query hooks for Project Members (Collaboration).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ProjectMember,
  ProjectMemberCreate,
  ProjectMemberUpdate,
  ProjectMemberListResponse,
} from "@/types/project-member";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/**
 * Fetch all members of a project.
 */
export function useProjectMembers(projectId: string) {
  return useQuery<ProjectMemberListResponse>({
    queryKey: ["projects", projectId, "members"],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/projects/${projectId}/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to fetch project members");
      }

      return response.json();
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
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/projects/${projectId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to invite member");
      }

      return response.json();
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
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/projects/${projectId}/members/${userId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to update member");
      }

      return response.json();
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
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${API_BASE}/projects/${projectId}/members/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to remove member");
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
