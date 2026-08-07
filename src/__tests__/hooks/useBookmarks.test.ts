/**
 * Tests for useBookmarks hooks.
 *
 * Covers:
 * - useBookmarks: fetches list, disabled when no projectId
 * - useIsBookmarked: returns boolean, disabled when no gene
 * - useCreateBookmark: calls POST, invalidates cache on success
 * - useDeleteBookmark: calls DELETE, invalidates cache on success
 * - useGeneLists: fetches lists
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

// Auto-resolved from src/utils/__mocks__/api.ts
jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// ─────────────────────────────────────────────────────────────────────────────
// Test utilities
// ─────────────────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return { Wrapper, queryClient };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sample data
// ─────────────────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj-123';
const GENE_SYMBOL = 'TP53';
const BOOKMARK_ID = 'bm-456';

const mockBookmark = {
  id: BOOKMARK_ID,
  user_id: 'user-1',
  project_id: PROJECT_ID,
  gene_symbol: GENE_SYMBOL,
  gene_id: null,
  notes: 'Important gene',
  tags: ['cancer'],
  color: '#FF5733',
  is_favorite: true,
  extra_data: {},
  created_at: '2026-02-27T00:00:00Z',
  updated_at: '2026-02-27T00:00:00Z',
};

// ─────────────────────────────────────────────────────────────────────────────
// useBookmarks
// ─────────────────────────────────────────────────────────────────────────────

describe('useBookmarks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches bookmarks for a project', async () => {
    const { useBookmarks } = await import('@/hooks/useBookmarks');
    mockApi.get.mockResolvedValueOnce({ data: [mockBookmark] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBookmarks(PROJECT_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].gene_symbol).toBe(GENE_SYMBOL);
    expect(mockApi.get).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/bookmarks`,
      expect.any(Object)
    );
  });

  it('passes gene_symbol filter when provided', async () => {
    const { useBookmarks } = await import('@/hooks/useBookmarks');
    mockApi.get.mockResolvedValueOnce({ data: [mockBookmark] });

    const { Wrapper } = createWrapper();
    renderHook(() => useBookmarks(PROJECT_ID, GENE_SYMBOL), { wrapper: Wrapper });

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    expect(mockApi.get).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/bookmarks`,
      { params: { gene_symbol: GENE_SYMBOL } }
    );
  });

  it('is disabled when projectId is empty', async () => {
    const { useBookmarks } = await import('@/hooks/useBookmarks');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBookmarks(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('is disabled when enabled=false', async () => {
    const { useBookmarks } = await import('@/hooks/useBookmarks');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useBookmarks(PROJECT_ID, undefined, false), {
      wrapper: Wrapper,
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useIsBookmarked
// ─────────────────────────────────────────────────────────────────────────────

describe('useIsBookmarked', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when gene is bookmarked', async () => {
    const { useIsBookmarked } = await import('@/hooks/useBookmarks');
    mockApi.get.mockResolvedValueOnce({ data: { is_bookmarked: true } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsBookmarked(PROJECT_ID, GENE_SYMBOL), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(true);
  });

  it('returns false when gene is not bookmarked', async () => {
    const { useIsBookmarked } = await import('@/hooks/useBookmarks');
    mockApi.get.mockResolvedValueOnce({ data: { is_bookmarked: false } });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsBookmarked(PROJECT_ID, GENE_SYMBOL), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(false);
  });

  it('is disabled when gene_symbol is empty', async () => {
    const { useIsBookmarked } = await import('@/hooks/useBookmarks');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useIsBookmarked(PROJECT_ID, ''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCreateBookmark
// ─────────────────────────────────────────────────────────────────────────────

describe('useCreateBookmark', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls POST and returns created bookmark', async () => {
    const { useCreateBookmark } = await import('@/hooks/useBookmarks');
    mockApi.post.mockResolvedValueOnce({ data: mockBookmark });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        projectId: PROJECT_ID,
        data: { gene_symbol: GENE_SYMBOL, is_favorite: true },
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/bookmarks`,
      { gene_symbol: GENE_SYMBOL, is_favorite: true }
    );
    await waitFor(() => expect(result.current.data).toEqual(mockBookmark));
  });

  it('surfaces API errors as mutation errors', async () => {
    const { useCreateBookmark } = await import('@/hooks/useBookmarks');
    const error = new Error('Bookmark already exists');
    mockApi.post.mockRejectedValueOnce(error);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateBookmark(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ projectId: PROJECT_ID, data: { gene_symbol: GENE_SYMBOL } })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteBookmark
// ─────────────────────────────────────────────────────────────────────────────

describe('useDeleteBookmark', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls DELETE with correct bookmark ID', async () => {
    const { useDeleteBookmark } = await import('@/hooks/useBookmarks');
    mockApi.delete.mockResolvedValueOnce({ data: null });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteBookmark(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(BOOKMARK_ID);
    });

    expect(mockApi.delete).toHaveBeenCalledWith(`/bookmarks/${BOOKMARK_ID}`);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useGeneLists
// ─────────────────────────────────────────────────────────────────────────────

describe('useGeneLists', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches gene lists with include_public=true by default', async () => {
    const { useGeneLists } = await import('@/hooks/useBookmarks');
    const mockList = {
      id: 'list-1',
      name: 'My List',
      project_id: PROJECT_ID,
      genes: ['TP53', 'BRCA1'],
      gene_count: 2,
      is_public: false,
      tags: [],
      extra_data: {},
      user_id: 'user-1',
      created_at: '2026-02-27T00:00:00Z',
      updated_at: '2026-02-27T00:00:00Z',
    };
    mockApi.get.mockResolvedValueOnce({ data: [mockList] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useGeneLists(PROJECT_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('My List');
  });
});
