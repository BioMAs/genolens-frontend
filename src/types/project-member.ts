/**
 * Type definitions for Project Members (Collaboration).
 */

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  access_level: UserRole;
  created_at: string;
  updated_at: string;
  
  // Optional user info from external service
  user_email?: string;
  user_name?: string;
}

export interface ProjectMemberCreate {
  user_email: string;
  access_level: UserRole;
}

export interface ProjectMemberUpdate {
  access_level: UserRole;
}

export interface ProjectMemberListResponse {
  members: ProjectMember[];
  total: number;
}
