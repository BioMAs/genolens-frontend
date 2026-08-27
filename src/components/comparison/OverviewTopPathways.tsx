'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '@/utils/api';
import type { Dataset } from '@/types';

interface Props {
  /** Dataset holding the enrichment pathways; absent → nothing to show yet. */
  enrichmentDataset?: Dataset;
  comparisonName: string;
  /** Opens the Enrichment tab, where the full analysis lives. */
  onOpenEnrichment: () => void;
  maxTerms?: number;
}

interface Pathway {
  id: string;
  name: string;
  padj: number;
  score: number;
  geneCount: number;
  category?: string;
  regulation?: string;
}

const PADJ_MAX = 0.05;
/* Indigo, the pathway colour across the app (--sl-purple). Recharts writes it
   into a `fill` attribute, so the token is resolved by the browser. */
const BAR_COLOR = 'var(--sl-purple)';

function truncate(label: string, max = 34) {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function PathwayTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Pathway }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      className="max-w-xs rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}
    >
      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{p.name}</div>
      <div className="mt-1" style={{ color: 'var(--text-secondary)' }}>
        adj. p {p.padj.toExponential(2)} · {p.geneCount} gene{p.geneCount === 1 ? '' : 's'}
        {p.category ? ` · ${p.category}` : ''}
      </div>
      {p.id && <div className="mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>{p.id}</div>}
    </div>
  );
}

/**
 * Top enriched pathways of a comparison, ranked by adjusted p-value.
 *
 * Reads the cached pathways of the ENRICHMENT dataset — the same endpoint the
 * Enrichment tab uses — so the overview costs one small request and never
 * recomputes the analysis.
 */
export default function OverviewTopPathways({
  enrichmentDataset,
  comparisonName,
  onOpenEnrichment,
  maxTerms = 8,
}: Props) {
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [loading, setLoading] = useState(!!enrichmentDataset);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enrichmentDataset) {
      setPathways([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    (async () => {
      try {
        const res = await api.get(
          `/datasets/${enrichmentDataset.id}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
          {
            params: {
              regulation: 'ALL',
              page: 1,
              page_size: 100,
              padj_max: PADJ_MAX,
              sort_by: 'padj',
              sort_order: 'asc',
            },
          }
        );
        if (cancelled) return;

        const rows: Record<string, unknown>[] = res.data?.pathways ?? [];
        const parsed = rows
          .map((row): Pathway => {
            const padj = Number(row.padj ?? row.pvalue ?? 1);
            return {
              id: row.pathway_id ? String(row.pathway_id) : '',
              name: row.pathway_name ? String(row.pathway_name) : String(row.description ?? '—'),
              padj,
              // -log10(padj): higher bar = stronger evidence. Floored so a padj
              // of 0 (rounded down by the backend) stays plottable.
              score: padj > 0 ? -Math.log10(padj) : 30,
              geneCount: Number(row.gene_count ?? 0),
              category: row.category ? String(row.category) : undefined,
              regulation: row.regulation ? String(row.regulation) : undefined,
            };
          })
          .filter((p) => Number.isFinite(p.score) && p.padj <= PADJ_MAX)
          .slice(0, maxTerms);

        setPathways(parsed);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enrichmentDataset, comparisonName, maxTerms]);

  const body = () => {
    if (loading) {
      return (
        <div className="space-y-2 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-5 rounded" style={{ width: `${95 - i * 11}%` }} />
          ))}
        </div>
      );
    }

    if (!enrichmentDataset || failed || pathways.length === 0) {
      const message = !enrichmentDataset
        ? 'No enrichment results are attached to this comparison yet.'
        : failed
          ? 'Enrichment results could not be loaded.'
          : `No pathway reaches adj. p ≤ ${PADJ_MAX}.`;
      return (
        <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-center">
          <p className="max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
          <button
            type="button"
            onClick={onOpenEnrichment}
            className="text-xs font-semibold"
            style={{ color: 'var(--sl-teal-dark)' }}
          >
            Open Enrichment →
          </button>
        </div>
      );
    }

    // Strongest term on top: recharts draws categories top-down.
    const data = [...pathways].reverse();

    return (
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 30 + 40)}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 16, left: 4 }}>
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
            stroke="var(--border-strong)"
            label={{
              value: '−log10(adj. p)',
              position: 'insideBottom',
              offset: -8,
              style: { fontSize: 10, fill: 'var(--text-muted)' },
            }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={170}
            tickFormatter={(value: string) => truncate(value)}
            tick={{ fontSize: 10.5, fill: 'var(--text-secondary)' }}
            stroke="var(--border-strong)"
          />
          <Tooltip content={<PathwayTooltip />} cursor={{ fill: 'var(--hover-overlay)' }} />
          {/* Animation off: with recharts 3.6 + React 19 the grow-in transition
              stalls and the bars stay 1px slivers (verified in the browser). */}
          <Bar dataKey="score" radius={[0, 3, 3, 0]} barSize={14} isAnimationActive={false}>
            {data.map((p) => (
              <Cell key={p.id || p.name} fill={BAR_COLOR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="gl-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Top enriched pathways
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Ranked by adjusted p-value · adj. p ≤ {PADJ_MAX}
          </p>
        </div>
        {pathways.length > 0 && (
          <button
            type="button"
            onClick={onOpenEnrichment}
            className="text-xs font-semibold"
            style={{ color: 'var(--sl-teal-dark)' }}
          >
            All pathways →
          </button>
        )}
      </div>
      {body()}
    </div>
  );
}
