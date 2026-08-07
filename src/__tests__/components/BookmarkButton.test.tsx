/**
 * Tests for the BookmarkButton component.
 *
 * Covers:
 * - Renders icon variant by default (Star icon)
 * - Shows "Bookmark" text in button variant when not bookmarked
 * - Shows "Bookmarked" text in button variant when bookmarked
 * - Calls createBookmark on click when not bookmarked
 * - Calls deleteBookmark on click when already bookmarked
 * - Disabled during loading states
 */
/* eslint-disable @typescript-eslint/no-require-imports */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockCreateBookmark = jest.fn().mockResolvedValue({});
const mockDeleteBookmark = jest.fn().mockResolvedValue({});

jest.mock('@/hooks/useBookmarks', () => ({
  useIsBookmarked: jest.fn(),
  useBookmarks: jest.fn(),
  useCreateBookmark: jest.fn(() => ({
    mutateAsync: mockCreateBookmark,
    isPending: false,
  })),
  useDeleteBookmark: jest.fn(() => ({
    mutateAsync: mockDeleteBookmark,
    isPending: false,
  })),
}));

import {
  useIsBookmarked,
  useBookmarks,
  useCreateBookmark,
} from '@/hooks/useBookmarks';

const mockUseIsBookmarked = useIsBookmarked as jest.Mock;
const mockUseBookmarks = useBookmarks as jest.Mock;

// Helper to set bookmark state before rendering
function setupBookmarkState(isBookmarked: boolean, bookmark?: object) {
  mockUseIsBookmarked.mockReturnValue({ data: isBookmarked, isLoading: false });
  mockUseBookmarks.mockReturnValue({
    data: bookmark ? [bookmark] : [],
    isLoading: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  projectId: 'proj-1',
  geneSymbol: 'TP53',
};

describe('BookmarkButton — icon variant (default)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a button when not bookmarked', () => {
    setupBookmarkState(false);
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} />);

    const btn = screen.getByRole('button');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', 'Add bookmark');
  });

  it('shows "Remove bookmark" title when gene is bookmarked', () => {
    setupBookmarkState(true, { id: 'bm-1', gene_symbol: 'TP53' });
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button')).toHaveAttribute('title', 'Remove bookmark');
  });

  it('is disabled while isLoading=true', () => {
    mockUseIsBookmarked.mockReturnValue({ data: undefined, isLoading: true });
    mockUseBookmarks.mockReturnValue({ data: [], isLoading: false });
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls createBookmark when clicked on unbookmarked gene', async () => {
    setupBookmarkState(false);
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mockCreateBookmark).toHaveBeenCalledTimes(1));
    expect(mockCreateBookmark).toHaveBeenCalledWith({
      projectId: DEFAULT_PROPS.projectId,
      data: {
        gene_symbol: DEFAULT_PROPS.geneSymbol,
        gene_id: undefined,
        is_favorite: true,
      },
    });
  });

  it('calls deleteBookmark when clicked on bookmarked gene', async () => {
    const existingBookmark = { id: 'bm-42', gene_symbol: 'TP53' };
    setupBookmarkState(true, existingBookmark);
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} />);

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mockDeleteBookmark).toHaveBeenCalledTimes(1));
    expect(mockDeleteBookmark).toHaveBeenCalledWith('bm-42');
  });
});

describe('BookmarkButton — button variant', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "Bookmark" label when not bookmarked', () => {
    setupBookmarkState(false);
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} variant="button" />);

    expect(screen.getByText('Bookmark')).toBeInTheDocument();
  });

  it('shows "Bookmarked" label when gene is bookmarked', () => {
    setupBookmarkState(true, { id: 'bm-1' });
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} variant="button" />);

    expect(screen.getByText('Bookmarked')).toBeInTheDocument();
  });

  it('is disabled during createBookmark mutation', () => {
    setupBookmarkState(false);
    (useCreateBookmark as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateBookmark,
      isPending: true,
    });
    const { default: BookmarkButton } = require('@/components/BookmarkButton');
    render(<BookmarkButton {...DEFAULT_PROPS} variant="button" />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});
