'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { Dataset } from '@/types';

type Row = Record<string, unknown>;

/**
 * Build a {sample -> condition} map for ALL samples of a sample-metadata dataset
 * (unfiltered — every condition in the analysis). Column names are resolved from
 * the dataset's column_mapping, with the usual fallbacks.
 */
export function useSampleConditionMap(samplesDataset?: Dataset) {
  const datasetId = samplesDataset?.id;
  return useQuery({
    queryKey: ['sample-condition-map', datasetId],
    enabled: !!datasetId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const resp = await api.post(`/datasets/${datasetId}/query`, { limit: 5000 });
      const rows: Row[] = Array.isArray(resp.data?.data) ? resp.data.data : [];
      const cm = (samplesDataset?.column_mapping ?? {}) as Record<string, string>;
      const sampleCol = cm.sample_id || cm.sample || 'sample_id';
      const conditionCol = cm.condition || 'condition';

      const map: Record<string, string> = {};
      for (const r of rows) {
        const s = r[sampleCol] ?? r.sample ?? r['ini.sample.name'];
        const c = r[conditionCol] ?? r.condition;
        if (s != null && c != null) map[String(s)] = String(c);
      }
      return map;
    },
  });
}
