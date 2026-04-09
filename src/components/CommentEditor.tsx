/**
 * CommentEditor: Component for writing and editing comments
 */
'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CommentType } from '@/types/comment';

interface CommentEditorProps {
  projectId: string;
  commentType?: CommentType;
  targetId?: string;
  parentId?: string;
  initialContent?: string;
  placeholder?: string;
  onSubmit: (content: string) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export default function CommentEditor({
  projectId,
  commentType = 'GENERAL',
  targetId,
  parentId,
  initialContent = '',
  placeholder = 'Write a comment... (Markdown supported)',
  onSubmit,
  onCancel,
  submitLabel = 'Post Comment',
  isSubmitting = false,
}: CommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [isPreview, setIsPreview] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isSubmitting) return;

    await onSubmit(content);
    setContent('');
  };

  const handleCancel = () => {
    setContent(initialContent);
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Textarea */}
      <div className="relative">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          disabled={isSubmitting}
          className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          rows={4}
        />
        
        {/* Character count */}
        <div className="absolute bottom-2 right-2 text-xs text-gray-400">
          {content.length} characters
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {isPreview ? 'Edit' : 'Preview'}
          </button>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Markdown supported
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          )}
          
          <Button
            type="submit"
            variant="default"
            size="sm"
            disabled={!content.trim() || isSubmitting}
          >
            <Send className="mr-1 h-4 w-4" />
            {isSubmitting ? 'Posting...' : submitLabel}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {isPreview && content && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Preview:
          </p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {content.split('\n').map((line, idx) => (
              <p key={idx}>{line || '\u00A0'}</p>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
