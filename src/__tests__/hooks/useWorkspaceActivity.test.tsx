/**
 * Le fil d'activite du dashboard, fusionne a partir des historiques par projet.
 *
 * L'API n'a pas d'historique global : le hook lit les projets les plus
 * recemment modifies et fusionne. Ce qui doit tenir : l'ordre est
 * chronologique sur l'ensemble (pas projet par projet), chaque entree sait de
 * quel projet elle vient, et seuls les projets les plus recents sont lus.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import api from '@/utils/api';
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity';
import type { Project } from '@/types';

jest.mock('@/utils/api');
const mockApi = api as jest.Mocked<typeof api>;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const project = (id: string, updated_at: string) =>
  ({ id, name: `Project ${id}`, updated_at, created_at: updated_at }) as unknown as Project;

const event = (id: string, project_id: string, created_at: string) => ({
  id,
  project_id,
  user_id: 'u1',
  event_type: 'dataset_uploaded',
  entity_name: `${id}.tsv`,
  extra_metadata: {},
  created_at,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.get.mockImplementation(async (url: string) => {
    const pid = url.split('/')[2];
    const items =
      pid === 'a'
        ? [event('a2', 'a', '2026-10-11T10:00:00Z'), event('a1', 'a', '2026-10-09T10:00:00Z')]
        : pid === 'b'
          ? [event('b1', 'b', '2026-10-10T10:00:00Z')]
          : [];
    return { data: { items, total: items.length, limit: 6, offset: 0 } };
  });
});

it('merges every project into one timeline, newest first, tagged with its project', async () => {
  const { result } = renderHook(
    () => useWorkspaceActivity([project('a', '2026-10-11T00:00:00Z'), project('b', '2026-10-10T00:00:00Z')]),
    { wrapper },
  );

  await waitFor(() => expect(result.current.items).toHaveLength(3));
  expect(result.current.items.map((e) => e.id)).toEqual(['a2', 'b1', 'a1']);
  expect(result.current.items[1].project_name).toBe('Project b');
});

it('reads only the five most recently updated projects', async () => {
  const projects = Array.from({ length: 8 }, (_, i) =>
    project(`p${i}`, `2026-10-0${i + 1}T00:00:00Z`),
  );
  renderHook(() => useWorkspaceActivity(projects), { wrapper });

  await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(5));
  const read = mockApi.get.mock.calls.map(([url]) => String(url).split('/')[2]).sort();
  expect(read).toEqual(['p3', 'p4', 'p5', 'p6', 'p7']);
});

it('caps the feed at the requested length', async () => {
  const { result } = renderHook(
    () => useWorkspaceActivity([project('a', '2026-10-11T00:00:00Z'), project('b', '2026-10-10T00:00:00Z')], 2),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.items.map((e) => e.id)).toEqual(['a2', 'b1']);
});
