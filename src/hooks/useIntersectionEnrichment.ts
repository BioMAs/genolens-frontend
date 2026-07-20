'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * Trigger and poll an ad-hoc annoDB functional enrichment job for a selected
 * intersection's gene set. Mirrors the report-status polling style.
 */
export function useIntersectionEnrichment(pathDatasetId: string) {
  const [status, setStatus] = useState<EnrichmentStatus>('idle');
  const [result, setResult] = useState<EnrichmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const reset = useCallback(() => {
    clearTimer();
    setStatus('idle');
    setResult(null);
    setError(null);
    setJobId(null);
  }, []);

  const run = useCallback(
    async (genes: string[], label: string, species?: string) => {
      clearTimer();
      setResult(null);
      setError(null);
      setStatus('PENDING');
      try {
        const resp = await api.post(
          `/datasets/${pathDatasetId}/intersection-enrichment`,
          { genes, label, ...(species ? { species } : {}) }
        );
        setJobId(resp.data.job_id);
      } catch (err: unknown) {
        const detail = (err as ApiErrorShape)?.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Failed to start enrichment');
        setStatus('FAILED');
      }
    },
    [pathDatasetId]
  );

  // Poll the job while it is running.
  useEffect(() => {
    if (!jobId || (status !== 'PENDING' && status !== 'RUNNING')) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const resp = await api.get(`/intersection-enrichment/${jobId}`);
        if (cancelled) return;
        const s: EnrichmentStatus = resp.data.status;
        setStatus(s);
        if (s === 'DONE') {
          setResult(resp.data.result || []);
        } else if (s === 'FAILED') {
          setError(resp.data.error_message || 'Enrichment failed');
        } else {
          timer.current = setTimeout(poll, 2000);
        }
      } catch {
        if (!cancelled) timer.current = setTimeout(poll, 3000);
      }
    };
    timer.current = setTimeout(poll, 1500);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [jobId, status]);

  useEffect(() => clearTimer, []);

  return { status, result, error, jobId, run, reset };
}
