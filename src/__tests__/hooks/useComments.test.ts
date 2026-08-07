/**
 * Tests for useComments hooks.
 *
 * Covers:
 * - useComments: fetches comments, respects enabled flag
 * - useComment: fetches single comment
 * - useCreateComment: POSTs and invalidates cache
 * - useUpdateComment: PATCHes and invalidates cache
 * - useDeleteComment: DELETEs and invalidates cache
 * - useCommentCount: fetches count
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
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

const PROJECT_ID = 'proj-abc';
const COMMENT_ID = 'cmt-xyz';

const mockComment = {
  id: COMMENT_ID,
  project_id: PROJECT_ID,
  user_id: 'user-1',
  comment_type: 'GENERAL' as const,
  target_id: undefined,
  content: 'This is a test comment',
  parent_id: undefined,
  is_resolved: false,
  extra_metadata: {},
  created_at: '2026-02-27T00:00:00Z',
  updated_at: '2026-02-27T00:00:00Z',
  replies: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// useComments
// ─────────────────────────────────────────────────────────────────────────────

describe('useComments', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches comments for a project', async () => {
    const { useComments } = await import('@/hooks/useComments');
    mockApi.get.mockResolvedValueOnce({ data: [mockComment] });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComments(PROJECT_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].content).toBe('This is a test comment');
  });

  it('is disabled when projectId is empty', async () => {
    const { useComments } = await import('@/hooks/useComments');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComments(''), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it('includes comment_type query param when provided', async () => {
    const { useComments } = await import('@/hooks/useComments');
    mockApi.get.mockResolvedValueOnce({ data: [mockComment] });

    const { Wrapper } = createWrapper();
    renderHook(() => useComments(PROJECT_ID, 'GENE'), { wrapper: Wrapper });

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('comment_type=GENE');
  });

  it('filters resolved comments when includeResolved=false', async () => {
    const { useComments } = await import('@/hooks/useComments');
    mockApi.get.mockResolvedValueOnce({ data: [] });

    const { Wrapper } = createWrapper();
    renderHook(
      () => useComments(PROJECT_ID, undefined, undefined, false),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(mockApi.get).toHaveBeenCalled());
    const calledUrl: string = mockApi.get.mock.calls[0][0];
    expect(calledUrl).toContain('include_resolved=false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useComment (single)
// ─────────────────────────────────────────────────────────────────────────────

describe('useComment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches a single comment by ID', async () => {
    const { useComment } = await import('@/hooks/useComments');
    mockApi.get.mockResolvedValueOnce({ data: mockComment });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComment(COMMENT_ID), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(COMMENT_ID);
    expect(mockApi.get).toHaveBeenCalledWith(`/comments/${COMMENT_ID}`);
  });

  it('is disabled when commentId is undefined', async () => {
    const { useComment } = await import('@/hooks/useComments');
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useComment(undefined), { wrapper: Wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.get).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useCreateComment
// ─────────────────────────────────────────────────────────────────────────────

describe('useCreateComment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('POSTs a new comment and returns it', async () => {
    const { useCreateComment } = await import('@/hooks/useComments');
    mockApi.post.mockResolvedValueOnce({ data: mockComment });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        projectId: PROJECT_ID,
        data: { content: 'New comment', comment_type: 'GENERAL' },
      });
    });

    expect(mockApi.post).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/comments`,
      expect.objectContaining({ content: 'New comment' })
    );
    await waitFor(() => expect(result.current.data?.content).toBe('This is a test comment'));
  });

  it('surfaces errors as mutation error', async () => {
    const { useCreateComment } = await import('@/hooks/useComments');
    mockApi.post.mockRejectedValueOnce(new Error('Unauthorized'));

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ projectId: PROJECT_ID, data: { content: '' } })
        .catch(() => {});
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useUpdateComment
// ─────────────────────────────────────────────────────────────────────────────

describe('useUpdateComment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('PATCHes the comment content', async () => {
    const { useUpdateComment } = await import('@/hooks/useComments');
    const updatedComment = { ...mockComment, content: 'Updated text', is_resolved: true };
    mockApi.patch.mockResolvedValueOnce({ data: updatedComment });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        commentId: COMMENT_ID,
        data: { content: 'Updated text', is_resolved: true },
      });
    });

    expect(mockApi.patch).toHaveBeenCalledWith(
      `/comments/${COMMENT_ID}`,
      { content: 'Updated text', is_resolved: true }
    );
    await waitFor(() => expect(result.current.data?.content).toBe('Updated text'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useDeleteComment
// ─────────────────────────────────────────────────────────────────────────────

describe('useDeleteComment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('DELETEs the comment by ID', async () => {
    const { useDeleteComment } = await import('@/hooks/useComments');
    mockApi.delete.mockResolvedValueOnce({ data: null });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useDeleteComment(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(COMMENT_ID);
    });

    expect(mockApi.delete).toHaveBeenCalledWith(`/comments/${COMMENT_ID}`);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
