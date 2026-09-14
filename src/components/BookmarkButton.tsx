/**
 * BookmarkButton: Simple button to bookmark/unbookmark a gene
 * Can be used inline in gene tables
 */
'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { useCreateBookmark, useDeleteBookmark, useIsBookmarked, useBookmarks } from '@/hooks/useBookmarks';
import { cn } from '@/lib/cn';

interface BookmarkButtonProps {
  projectId: string;
  geneSymbol: string;
  geneId?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'button';
  className?: string;
}

export default function BookmarkButton({
  projectId,
  geneSymbol,
  geneId,
  size = 'md',
  variant = 'icon',
  className = '',
}: BookmarkButtonProps) {
  const { data: isBookmarked, isLoading: checkLoading } = useIsBookmarked(projectId, geneSymbol);
  const { data: bookmarks } = useBookmarks(projectId, geneSymbol);
  const createBookmark = useCreateBookmark();
  const deleteBookmark = useDeleteBookmark();

  const [isHovered, setIsHovered] = useState(false);

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const buttonSizeClasses = {
    sm: 'px-2 py-1 text-caption',
    md: 'px-3 py-1.5 text-body-sm',
    lg: 'px-4 py-2 text-body',
  };

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isBookmarked && bookmarks && bookmarks.length > 0) {
      // Remove bookmark
      try {
        await deleteBookmark.mutateAsync(bookmarks[0].id);
        console.log(`Bookmark removed: ${geneSymbol}`);
      } catch (error) {
        console.error('Failed to remove bookmark:', error);
      }
    } else {
      // Add bookmark
      try {
        await createBookmark.mutateAsync({
          projectId,
          data: {
            gene_symbol: geneSymbol,
            gene_id: geneId,
            is_favorite: true,
          },
        });
        console.log(`Bookmark added: ${geneSymbol}`);
      } catch (error) {
        console.error('Failed to add bookmark:', error);
      }
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggleBookmark}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={checkLoading || createBookmark.isPending || deleteBookmark.isPending}
        className={cn(
          'inline-flex items-center justify-center rounded-pill p-1 transition-colors hover:bg-hover disabled:opacity-50',
          className,
        )}
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        <Star
          className={cn(
            sizeClasses[size],
            'transition-colors',
            isBookmarked ? 'fill-warning-ink text-warning-ink' : isHovered ? 'text-warning-ink' : 'text-muted',
          )}
        />
      </button>
    );
  }

  return (
    <button
      onClick={handleToggleBookmark}
      disabled={checkLoading || createBookmark.isPending || deleteBookmark.isPending}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border transition-colors disabled:opacity-50',
        isBookmarked ? 'border-warning bg-warning-soft text-warning-ink hover:bg-warning-soft' : 'border-strong bg-surface text-primary hover:bg-hover',
        buttonSizeClasses[size],
        className,
      )}
    >
      <Star
        className={cn(
          sizeClasses[size],
          isBookmarked ? 'fill-warning-ink text-warning-ink' : 'text-muted',
        )}
      />
      {isBookmarked ? 'Bookmarked' : 'Bookmark'}
    </button>
  );
}
