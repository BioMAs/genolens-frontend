'use client';

import { useState, useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface OverviewEnrichmentTopProps {
  dataset: Dataset;
  comparisonName: string;
}

interface PathwayRow {
  pathway_id?: string;
  pathway_name?: string;
  description?: string;
  padj: number;
  gene_count?: number;
  regulation?: string;
}

export default function OverviewEnrichmentTop({ dataset, comparisonName }: OverviewEnrichmentTopProps) {
  const [upTerms, setUpTerms] = useState<PathwayRow[]>([]);
  const [downTerms, setDownTerms] = useState<PathwayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchTerms = async () => {
      setLoading(true);
      try {
        const [upRes, downRes] = await Promise.all([
          api.get(
            `/datasets/${dataset.id}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
            { params: { regulation: 'UP', page_size: 6, sort_by: 'padj', sort_order: 'asc' } }
          ),
          api.get(
            `/datasets/${dataset.id}/enrichment-pathways/${encodeURIComponent(comparisonName)}`,
            { params: { regulation: 'DOWN', page_size: 6, sort_by: 'padj', sort_order: 'asc' } }
          ),
        ]);
        if (!cancelled) {
          const up: PathwayRow[] = upRes.data?.pathways ?? [];
          const down: PathwayRow[] = downRes.data?.pathways ?? [];
          setUpTerms(up);
          setDownTerms(down);
          setHasData(up.length > 0 || down.length > 0);
        }
      } catch {
        // enrichment not run yet – hide section silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTerms();
    return () => { cancelled = true; };
  }, [dataset.id, comparisonName]);

  if (loading || !hasData) return null;

  const PathwayItem = ({
    pathway,
    accent,
  }: {
    pathway: PathwayRow;
    accent: 'teal' | 'purple';
  }) => {
    const name = pathway.pathway_name || pathway.pathway_id || '—';
    const isTeal = accent === 'teal';
    return (
      <div
        className="flex items-start justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs"
        style={{
          background: isTeal ? 'var(--sl-teal-light, #f0fdf4)' : 'rgba(124,58,237,0.06)',
          border: `1px solid ${isTeal ? 'var(--sl-teal-border, #bbf7d0)' : 'rgba(124,58,237,0.15)'}`,
        }}
      >
        <span
          className="font-medium truncate leading-tight"
          style={{ color: 'var(--text-primary)', maxWidth: '140px' }}
          title={name}
        >
          {name}
        </span>
        <span
          className="font-mono shrink-0"
          style={{ color: isTeal ? 'var(--sl-teal-dark, #15803d)' : '#7c3aed' }}
        >
          {pathway.padj < 0.001 ? pathway.padj.toExponential(1) : pathway.padj.toFixed(3)}
        </span>
      </div>
    );
  };

  return (
    <div className="gl-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
        <h3 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Top enrichments
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* UP-regulated enrichments */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--sl-teal-dark, #15803d)' }}>
            Up-regulated
          </p>
          <div className="space-y-1">
            {upTerms.length > 0
              ? upTerms.map((t, i) => <PathwayItem key={t.pathway_id ?? i} pathway={t} accent="teal" />)
              : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No terms</p>}
          </div>
        </div>

        {/* DOWN-regulated enrichments */}
        <div>
          <p className="text-xs font-semibold mb-2 text-purple-600">Down-regulated</p>
          <div className="space-y-1">
            {downTerms.length > 0
              ? downTerms.map((t, i) => <PathwayItem key={t.pathway_id ?? i} pathway={t} accent="purple" />)
              : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No terms</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
