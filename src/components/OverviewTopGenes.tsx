'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/utils/api';
import { Dataset } from '@/types';

interface OverviewTopGenesProps {
  dataset: Dataset;
  comparisonName: string;
}

interface GeneRow {
  gene_id: string;
  gene_name?: string;
  log_fc: number;
  padj: number;
}

export default function OverviewTopGenes({ dataset, comparisonName }: OverviewTopGenesProps) {
  const [upGenes, setUpGenes] = useState<GeneRow[]>([]);
  const [downGenes, setDownGenes] = useState<GeneRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchGenes = async () => {
      setLoading(true);
      try {
        const [upRes, downRes] = await Promise.all([
          api.get(`/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`, {
            params: { regulation: 'UP', page_size: 8, sort_by: 'log_fc', sort_order: 'desc' },
          }),
          api.get(`/datasets/${dataset.id}/deg-genes/${encodeURIComponent(comparisonName)}`, {
            params: { regulation: 'DOWN', page_size: 8, sort_by: 'log_fc', sort_order: 'asc' },
          }),
        ]);
        if (!cancelled) {
          setUpGenes(upRes.data.genes ?? []);
          setDownGenes(downRes.data.genes ?? []);
        }
      } catch {
        // silent – no data to display
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchGenes();
    return () => { cancelled = true; };
  }, [dataset.id, comparisonName]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs py-4" style={{ color: 'var(--text-muted)' }}>
        <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
        Loading top genes…
      </div>
    );
  }

  if (upGenes.length === 0 && downGenes.length === 0) {
    return (
      <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
        No significant DEGs found.
      </p>
    );
  }

  const GeneItem = ({ gene, direction }: { gene: GeneRow; direction: 'up' | 'down' }) => {
    const label = gene.gene_name || gene.gene_id;
    const fc = gene.log_fc;
    const isUp = direction === 'up';
    return (
      <div
        className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs"
        style={{
          background: isUp ? 'var(--sl-teal-light, #f0fdf4)' : 'rgba(124,58,237,0.06)',
          border: `1px solid ${isUp ? 'var(--sl-teal-border, #bbf7d0)' : 'rgba(124,58,237,0.15)'}`,
        }}
      >
        <span className="font-medium truncate max-w-[110px]" style={{ color: 'var(--text-primary)' }} title={label}>
          {label}
        </span>
        <span
          className="font-mono font-semibold ml-2 shrink-0"
          style={{ color: isUp ? 'var(--sl-teal-dark, #15803d)' : '#7c3aed' }}
        >
          {isUp ? '+' : ''}{fc.toFixed(2)}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* UP */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingUp className="h-3.5 w-3.5" style={{ color: 'var(--sl-teal-dark, #15803d)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--sl-teal-dark, #15803d)' }}>
            Top upregulated
          </span>
        </div>
        <div className="space-y-1">
          {upGenes.map((g) => <GeneItem key={g.gene_id} gene={g} direction="up" />)}
          {upGenes.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No upregulated genes</p>
          )}
        </div>
      </div>

      {/* DOWN */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <TrendingDown className="h-3.5 w-3.5 text-purple-600" />
          <span className="text-xs font-semibold text-purple-600">Top downregulated</span>
        </div>
        <div className="space-y-1">
          {downGenes.map((g) => <GeneItem key={g.gene_id} gene={g} direction="down" />)}
          {downGenes.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No downregulated genes</p>
          )}
        </div>
      </div>
    </div>
  );
}
