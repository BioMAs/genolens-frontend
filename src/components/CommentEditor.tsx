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
          className="w-full min-h-[100px] rounded-sm border border-strong px-3 py-2 text-body-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 dark:bg-gray-800 dark:text-gray-100"
          rows={4}
        />
        
        {/* Character count */}
        <div className="absolute bottom-2 right-2 text-caption text-muted">
          {content.length} characters
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className="text-caption text-secondary hover:text-primary"
          >
            {isPreview ? 'Edit' : 'Preview'}
          </button>
          <span className="text-caption text-muted">|</span>
          <span className="text-caption text-secondary">
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
        <div className="mt-3 rounded-sm bg-surface-2 p-3">
          <p className="text-caption font-medium text-secondary mb-2">
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
