/**
 * CommentsSection: Complete comments section with list and editor
 */
'use client';

import { useState } from 'react';
import {
  MessageSquare,
  Filter,
  CheckCircle,
  Circle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommentEditor from './CommentEditor';
import CommentThread from './CommentThread';
import { useComments, useCreateComment, useCommentCount } from '@/hooks/useComments';
import type { CommentType } from '@/types/comment';

interface CommentsSectionProps {
  projectId: string;
  commentType?: CommentType;
  targetId?: string;
  currentUserId?: string;
  title?: string;
  emptyMessage?: string;
}

export default function CommentsSection({
  projectId,
  commentType = 'GENERAL',
  targetId,
  currentUserId,
  title = 'Comments',
  emptyMessage = 'No comments yet. Be the first to comment!',
}: CommentsSectionProps) {
  const [includeResolved, setIncludeResolved] = useState(true);
  const [isAddingComment, setIsAddingComment] = useState(false);

  const { data: comments, isLoading } = useComments(
    projectId,
    commentType,
    targetId,
    includeResolved
  );

  const { data: countData } = useCommentCount(projectId, targetId);
  const createComment = useCreateComment();

  const handleAddComment = async (content: string) => {
    await createComment.mutateAsync({
      projectId,
      data: {
        content,
        comment_type: commentType,
        target_id: targetId,
      },
    });
    setIsAddingComment(false);
  };

  const unresolvedCount = comments?.filter((c) => !c.is_resolved).length || 0;
  const resolvedCount = comments?.filter((c) => c.is_resolved).length || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          {countData && (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              {countData.count}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setIncludeResolved(!includeResolved)}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
          >
            <Filter className="h-4 w-4" />
            {includeResolved ? 'All' : 'Unresolved'}
            <ChevronDown className="h-4 w-4" />
          </button>

          {/* Add comment button */}
          {!isAddingComment && (
            <Button
              onClick={() => setIsAddingComment(true)}
              size="sm"
              variant="default"
            >
              <MessageSquare className="mr-1 h-4 w-4" />
              Add Comment
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {(unresolvedCount > 0 || resolvedCount > 0) && (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
            <Circle className="h-4 w-4" />
            <span>{unresolvedCount} unresolved</span>
          </div>
          <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>{resolvedCount} resolved</span>
          </div>
        </div>
      )}

      {/* New comment editor */}
      {isAddingComment && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950">
          <CommentEditor
            projectId={projectId}
            commentType={commentType}
            targetId={targetId}
            onSubmit={handleAddComment}
            onCancel={() => setIsAddingComment(false)}
            isSubmitting={createComment.isPending}
          />
        </div>
      )}

      {/* Comments list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-indigo-600" />
        </div>
      ) : !comments || comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center dark:border-gray-700">
          <MessageSquare className="mb-3 h-12 w-12 text-gray-400" />
          <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              projectId={projectId}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
