/**
 * Le fil d'activite de l'espace de travail, tous projets confondus.
 *
 * L'API n'expose l'historique que par projet (`GET /projects/{id}/history`).
 * Plutot que d'ajouter un point d'entree, on lit l'historique des projets les
 * plus recemment modifies — c'est la que l'activite recente se trouve — et on
 * fusionne. Les requetes partagent la cle de `useProjectHistory`, donc ouvrir
 * ensuite un projet trouve deja son historique en cache.
 */
import { useQueries } from '@tanstack/react-query';
import api from '@/utils/api';
import type { Project } from '@/types';
import type { ActivityLogEntry, ActivityLogListResponse } from '@/types/history';

export interface WorkspaceActivityEntry extends ActivityLogEntry {
  project_name: string;
}

/** Nombre de projets interroges : au-dela, le fil ne gagne plus rien de recent. */
const PROJECTS_SCANNED = 5;
const PER_PROJECT = 6;

export function useWorkspaceActivity(projects: Project[], limit = 6) {
  const recent = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, PROJECTS_SCANNED);

  const queries = useQueries({
    queries: recent.map((p) => ({
      queryKey: ['project-history', p.id, PER_PROJECT, 0, undefined] as const,
      queryFn: async () => {
        const res = await api.get<ActivityLogListResponse>(`/projects/${p.id}/history`, {
          params: { limit: PER_PROJECT, offset: 0 },
        });
        return res.data;
      },
      staleTime: 1000 * 30,
      gcTime: 1000 * 60 * 2,
    })),
  });

  const names = new Map(recent.map((p) => [p.id, p.name]));
  const items: WorkspaceActivityEntry[] = queries
    .flatMap((q) => q.data?.items ?? [])
    .map((e) => ({ ...e, project_name: names.get(e.project_id) ?? 'Project' }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  return {
    items,
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.length > 0 && queries.every((q) => q.isError),
  };
}
