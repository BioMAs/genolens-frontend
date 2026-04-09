/**
 * CommentThread: Component for displaying comment threads
 */
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Reply, Edit2, Trash2, Check, X, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CommentEditor from './CommentEditor';
import {
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
  useToggleCommentResolved,
} from '@/hooks/useComments';
import type { ProjectComment } from '@/types/comment';

interface CommentThreadProps {
  comment: ProjectComment;
  projectId: string;
  currentUserId?: string;
  level?: number;
  maxDepth?: number;
}

export default function CommentThread({
  comment,
  projectId,
  currentUserId,
  level = 0,
  maxDepth = 3,
}: CommentThreadProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const toggleResolved = useToggleCommentResolved();

  const isOwner = currentUserId === comment.user_id;
  const canReply = level < maxDepth;

  const handleReply = async (content: string) => {
    await createComment.mutateAsync({
      projectId,
      data: {
        content,
        comment_type: comment.comment_type,
        target_id: comment.target_id,
        parent_id: comment.id,
      },
    });
    setIsReplying(false);
  };

  const handleEdit = async (content: string) => {
    await updateComment.mutateAsync({
      commentId: comment.id,
      data: { content },
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this comment and all its replies?')) {
      await deleteComment.mutateAsync(comment.id);
    }
  };

  const handleToggleResolved = () => {
    toggleResolved.mutate(comment.id, !comment.is_resolved);
  };

  return (
    <div className={`${level > 0 ? 'ml-8' : ''}`}>
      <div className="group relative rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
              {comment.user_id.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                User {comment.user_id.slice(0, 8)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                {comment.updated_at !== comment.created_at && ' (edited)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {comment.is_resolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                <Check className="h-3 w-3" />
                Resolved
              </span>
            )}

            {/* Actions menu */}
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showActions && (
                <div className="absolute right-0 z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  <div className="py-1">
                    {isOwner && (
                      <>
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setShowActions(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                        >
                          <Edit2 className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            handleDelete();
                            setShowActions(false);
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        handleToggleResolved();
                        setShowActions(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {comment.is_resolved ? (
                        <>
                          <X className="h-4 w-4" />
                          Mark as Unresolved
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Mark as Resolved
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {isEditing ? (
          <CommentEditor
            projectId={projectId}
            initialContent={comment.content}
            onSubmit={handleEdit}
            onCancel={() => setIsEditing(false)}
            submitLabel="Save"
            isSubmitting={updateComment.isPending}
          />
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {comment.content.split('\n').map((line, idx) => (
              <p key={idx} className="mb-2 text-gray-700 dark:text-gray-300">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        )}

        {/* Reply button */}
        {!isEditing && canReply && (
          <div className="mt-3">
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <Reply className="h-4 w-4" />
              Reply
            </button>
          </div>
        )}

        {/* Reply editor */}
        {isReplying && (
          <div className="mt-3 rounded-md bg-gray-50 p-3 dark:bg-gray-900">
            <CommentEditor
              projectId={projectId}
              commentType={comment.comment_type}
              targetId={comment.target_id}
              parentId={comment.id}
              placeholder="Write a reply..."
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              submitLabel="Reply"
              isSubmitting={createComment.isPending}
            />
          </div>
        )}
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              projectId={projectId}
              currentUserId={currentUserId}
              level={level + 1}
              maxDepth={maxDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
