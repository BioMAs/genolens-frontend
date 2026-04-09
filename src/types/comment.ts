/**
 * Types for project comments and annotations
 */

export type CommentType = 'GENERAL' | 'GENE' | 'COMPARISON' | 'PATHWAY';

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  comment_type: CommentType;
  target_id?: string;
  content: string;
  parent_id?: string;
  is_resolved: boolean;
  extra_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  replies?: ProjectComment[];
}

export interface ProjectCommentCreate {
  content: string;
  comment_type?: CommentType;
  target_id?: string;
  parent_id?: string;
  extra_metadata?: Record<string, any>;
}

export interface ProjectCommentUpdate {
  content?: string;
  is_resolved?: boolean;
  extra_metadata?: Record<string, any>;
}

export interface CommentThread {
  comment: ProjectComment;
  reply_count: number;
}

export interface CommentCount {
  count: number;
  by_type: Record<string, number>;
}
