/**
 * useProjectMembers must authenticate through the shared `api` client.
 *
 * It used to call `fetch` with `localStorage.getItem("token")`, a key nothing
 * writes: every request carried `Bearer null`, the backend answered 401, and
 * project permissions (ProjectHub, analyses list) never loaded.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useProjectMembers, useRemoveProjectMember } from '@/hooks/useProjectMembers';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}

describe('useProjectMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads members through the authenticated api client', async () => {
    const payload = { members: [{ user_id: 'u1', role: 'VIEWER' }], total: 1 };
    mockApi.get.mockResolvedValue({ data: payload });
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;

    const { result } = renderHook(() => useProjectMembers('proj-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(mockApi.get).toHaveBeenCalledWith('/projects/proj-1/members');
    expect(fetchSpy).not.toHaveBeenCalled();
    global.fetch = originalFetch;
  });

  it('surfaces the backend detail as the error message', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { detail: 'Access denied' } } });

    const { result } = renderHook(() => useProjectMembers('proj-1'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Access denied');
  });

  it('removes a member with DELETE on the member URL', async () => {
    mockApi.delete.mockResolvedValue({ data: null });

    const { result } = renderHook(() => useRemoveProjectMember('proj-1'), { wrapper: wrapper() });
    await result.current.mutateAsync('u2');

    expect(mockApi.delete).toHaveBeenCalledWith('/projects/proj-1/members/u2');
  });
});
