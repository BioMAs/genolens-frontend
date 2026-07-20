import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { GeoImportResponse, GeoSearchResponse } from '@/types';

// ---------------------------------------------------------------------------
// useGeoSearch — search NCBI GEO for importable RNA-seq series.
// Exposed as a mutation (search on demand rather than on every keystroke).
// ---------------------------------------------------------------------------

interface GeoSearchParams {
  query: string;
  maxResults?: number;
  countsOnly?: boolean;
}

export function useGeoSearch() {
  return useMutation<GeoSearchResponse, Error, GeoSearchParams>({
    mutationFn: async ({ query, maxResults = 10, countsOnly = true }) => {
      const res = await api.get<GeoSearchResponse>('/integrations/geo/search', {
        params: {
          q: query,
          max_results: maxResults,
          // NCBI's GEO E-utilities database is 'gds' (there is no 'geo' db).
          db: 'gds',
          counts_only: countsOnly,
        },
      });
      return res.data;
    },
  });
}

// ---------------------------------------------------------------------------
// useImportFromGeo — import a GEO series into a project (async ingestion).
// ---------------------------------------------------------------------------

interface GeoImportParams {
  projectId: string;
  accession: string;
  organism: string;
}

export function useImportFromGeo() {
  const qc = useQueryClient();
  return useMutation<GeoImportResponse, Error, GeoImportParams>({
    mutationFn: async ({ projectId, accession, organism }) => {
      const res = await api.post<GeoImportResponse>('/datasets/import-from-geo', {
        project_id: projectId,
        accession,
        organism,
      });
      return res.data;
    },
    onSuccess: (_data, { projectId }) => {
      qc.invalidateQueries({ queryKey: ['datasets', 'project', projectId] });
    },
  });
}
