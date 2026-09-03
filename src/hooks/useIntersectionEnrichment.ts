'use client';

/**
 * Functional enrichment of an arbitrary gene set, started and polled.
 *
 * `POST /datasets/{id}/intersection-enrichment` takes a plain list of genes, which makes it the
 * natural backend for "enrich what I just selected" — the volcano's lasso included, not only
 * the Venn intersection it was written for.
 *
 * Rewritten on React Query. The previous version polled with a hand-rolled `setTimeout` chain
 * and four `useState` flags: it never participated in the cache, its cancellation was manual,
 * and two callers asking about the same job would each have polled it. The public surface is
 * **unchanged** — `{ status, result, error, jobId, run, reset }` — because `MultiComparisonVenn`
 * depends on it and this is not the place to renegotiate that.
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import api from '@/utils/api';

export interface EnrichmentRow {
  pathway_id: string;
  pathway_name: string;
  category: string;
  pvalue: number | null;
  padj: number | null;
  gene_count: number;
  gene_ratio: string;
  bg_ratio: string;
  genes: string[];
}

export type EnrichmentStatus = 'idle' | 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';

interface ApiErrorShape {
  response?: { data?: { detail?: unknown } };
}

interface JobState {
  status: Exclude<EnrichmentStatus, 'idle'>;
  result?: EnrichmentRow[];
  error_message?: string;
}

/** How often to ask while the job is still running. */
const POLL_MS = 2000;

function startError(err: unknown): string {
  const detail = (err as ApiErrorShape)?.response?.data?.detail;
  return typeof detail === 'string' ? detail : 'Failed to start enrichment';
}

export function useIntersectionEnrichment(pathDatasetId: string) {
  const [jobId, setJobId] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: async (variables: { genes: string[]; label: string; species?: string }) => {
      const response = await api.post(
        `/datasets/${pathDatasetId}/intersection-enrichment`,
        {
          genes: variables.genes,
          label: variables.label,
          ...(variables.species ? { species: variables.species } : {}),
        }
      );
      return response.data.job_id as string;
    },
    onSuccess: (id) => setJobId(id),
  });

  const job = useQuery<JobState>({
    queryKey: ['intersection-enrichment', jobId],
    enabled: !!jobId,
    // The job's own status decides when to stop asking, so there is no timer to cancel and no
    // way to leave one running after the component goes.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'PENDING' || status === 'RUNNING' ? POLL_MS : false;
    },
    // A transient failure mid-job should not end the poll; the interval keeps asking.
    retry: 2,
    // A finished job never changes, and the key is the job id.
    staleTime: Infinity,
    gcTime: 1000 * 60 * 10,
    queryFn: async () => {
      const response = await api.get(`/intersection-enrichment/${jobId}`);
      return response.data as JobState;
    },
  });

  const run = useCallback(
    async (genes: string[], label: string, species?: string) => {
      setJobId(null);
      await start.mutateAsync({ genes, label, species }).catch(() => {
        // Surfaced through `error` below; rethrowing would make every caller wrap this.
      });
    },
    [start]
  );

  const reset = useCallback(() => {
    setJobId(null);
    start.reset();
  }, [start]);

  // `PENDING` from the moment the job is requested, so a caller's spinner starts immediately
  // rather than after the first poll comes back.
  const status: EnrichmentStatus = start.isError
    ? 'FAILED'
    : start.isPending
      ? 'PENDING'
      : jobId
        ? (job.data?.status ?? 'PENDING')
        : 'idle';

  const error = start.isError
    ? startError(start.error)
    : job.data?.status === 'FAILED'
      ? (job.data.error_message || 'Enrichment failed')
      : null;

  return {
    status,
    result: job.data?.status === 'DONE' ? (job.data.result ?? []) : null,
    error,
    jobId,
    run,
    reset,
  };
}
