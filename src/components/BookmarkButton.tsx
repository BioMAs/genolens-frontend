/**
 * BookmarkButton: Simple button to bookmark/unbookmark a gene
 * Can be used inline in gene tables
 */
'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';
import { useCreateBookmark, useDeleteBookmark, useBookmarks } from '@/hooks/useBookmarks';
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
  // One query for the whole project, shared by every button on the page (same
  // React Query key). The per-gene check + per-gene list it replaces fired two
  // requests per table row — 50 for one DEG page — and exhausted the API's
  // database pool.
  const { data: bookmarks, isLoading: checkLoading } = useBookmarks(projectId);
  // Guarded: a star must never take its host panel (volcano, DEG table) down
  // with it if the list comes back in an unexpected shape.
  const bookmark = Array.isArray(bookmarks)
    ? bookmarks.find((b) => b.gene_symbol === geneSymbol)
    : undefined;
  const isBookmarked = !!bookmark;
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

    if (bookmark) {
      // Remove bookmark
      try {
        await deleteBookmark.mutateAsync(bookmark.id);
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
