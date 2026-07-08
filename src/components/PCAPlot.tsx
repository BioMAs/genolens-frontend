'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { usePCAData } from '@/hooks/useVisualizations';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

interface PCAPlotProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

type MetadataRow = Record<string, string | number | boolean | null>;

interface PCADataPoint {
  sample: string;
  x: number;
  y: number;
  z: number;
  category?: string | number | boolean | null;
}

export default function PCAPlot({ dataset, metadataDataset }: PCAPlotProps) {
  // Utilise React Query pour gérer le cache PCA
  const { data: pcaData, isLoading, error: pcaError } = usePCAData(
    dataset.id,
    {},
    dataset.status === 'READY'
  );
  
  const [metadata, setMetadata] = useState<MetadataRow[]>([]);
  const [metadataColumns, setMetadataColumns] = useState<string[]>([]);
  const [selectedColorColumn, setSelectedColorColumn] = useState<string>('');
  const [joinColumn, setJoinColumn] = useState<string>('');
  const [colorblindMode, setColorblindMode] = useState(false);
  const palette = getPalette(colorblindMode ? 'colorblind' : 'standard');

  const error = pcaError ? 'Failed to calculate PCA. Ensure the dataset is a valid expression matrix.' : null;

  // Fetch Metadata if available and PCA is ready
  useEffect(() => {
    if (!metadataDataset || metadataDataset.status !== 'READY') {
        // Reset state when metadata dataset is unavailable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
        setMetadata([]);
        setMetadataColumns([]);
        setJoinColumn('');
        setSelectedColorColumn('');
        return;
    }

    const fetchMetadata = async () => {
      if (!pcaData) return;

      try {
        const resp = await api.post(`/datasets/${metadataDataset.id}/query`, {
          limit: 1000 // Assume < 1000 samples
        });
        const metaData = resp.data.data;
        setMetadata(metaData);
        
        const cols = resp.data.columns;

        // 1. Find the best column to join on (Sample ID)
        const pcaSamples = new Set((pcaData.data as PCADataPoint[]).map((d) => d.sample));
        let bestJoinCol = '';
        let maxOverlap = 0;

        cols.forEach((col: string) => {
          const metaValues = (metaData as MetadataRow[]).map((row) => row[col]);
          const overlap = metaValues.filter((v) => pcaSamples.has(String(v))).length;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestJoinCol = col;
            }
        });
        setJoinColumn(bestJoinCol);

        // 2. Filter columns suitable for coloring (categorical, < 20 unique values)
        // Exclude the join column itself if it's unique per sample (likely)
        const suitableCols = cols.filter((col: string) => {
            if (col === bestJoinCol) return false;
          const uniqueValues = new Set((metaData as MetadataRow[]).map((row) => row[col]));
            return uniqueValues.size > 1 && uniqueValues.size < 20;
        });
        setMetadataColumns(suitableCols);
        // Only set selectedColorColumn if it's not already set or not in the new list
        if (suitableCols.length > 0 && (!selectedColorColumn || !suitableCols.includes(selectedColorColumn))) {
            setSelectedColorColumn(suitableCols[0]);
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };

    fetchMetadata();
  }, [metadataDataset, pcaData, selectedColorColumn]);

  // Merge PCA with Metadata
  const plotData = useMemo(() => {
      if (!pcaData) return [];
      if (!selectedColorColumn || metadata.length === 0 || !joinColumn) return pcaData.data;

        return (pcaData.data as PCADataPoint[]).map((point) => {
          // Find matching metadata row using the detected join column
          const metaRow = metadata.find((m) => String(m[joinColumn]) === point.sample);
          
          return {
              ...point,
              category: metaRow ? metaRow[selectedColorColumn] : 'Unknown'
          };
      });
  }, [pcaData, metadata, selectedColorColumn, joinColumn]);

  // Generate Colors
  const uniqueCategories = useMemo(() => {
      if (!selectedColorColumn) return [];
      return Array.from(new Set((plotData as PCADataPoint[]).map((d) => d.category))).filter(Boolean);
  }, [plotData, selectedColorColumn]);

  const categoryColorMap = useMemo(() => {
      const map: Record<string, string> = {};
      uniqueCategories.forEach((cat, i) => {
          map[cat as string] = palette.categorical[i % palette.categorical.length];
      });
      map['Unknown'] = '#d1d5db';
      return map;
  }, [uniqueCategories, palette]);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>Calculating PCA…</div>;
  if (error) return <div className="flex h-64 items-center justify-center p-4 text-center text-sm" style={{ color: 'var(--sl-red-dark)' }}>{error}</div>;
  if (!pcaData) return null;

  const pc1 = (pcaData.explained_variance[0] * 100).toFixed(1);
  const pc2 = (pcaData.explained_variance[1] * 100).toFixed(1);
  const xLabel = `PC1 (${pc1}%)`;
  const yLabel = `PC2 (${pc2}%)`;
  const nSamples = pcaData.data?.length ?? 0;
  const read = `PC1 captures ${pc1}% and PC2 ${pc2}% of the variance across ${nSamples} samples${selectedColorColumn ? `, coloured by ${selectedColorColumn}` : ''}.`;

  return (
    <div className="gl-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sample PCA</h3>
        <div className="flex flex-wrap items-center gap-2">
          {metadataColumns.length > 0 && (
            <select
              value={selectedColorColumn}
              onChange={(e) => setSelectedColorColumn(e.target.value)}
              className="rounded-lg border p-1.5 text-sm"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              {metadataColumns.map((col) => (
                <option key={col} value={col}>Color by: {col}</option>
              ))}
            </select>
          )}
          <ColorblindToggle value={colorblindMode} onChange={setColorblindMode} />
          <AIChartAssistant
            datasetId={dataset.id}
            chartType="pca"
            contextKey="pca-default"
            context={{
              variance_pc1: pcaData ? +(pcaData.explained_variance[0] * 100).toFixed(1) : 0,
              variance_pc2: pcaData ? +(pcaData.explained_variance[1] * 100).toFixed(1) : 0,
              n_samples: nSamples,
              n_genes: 0,
              sample_groups: Array.from(new Set((plotData as PCADataPoint[]).map((d) => String(d.category ?? 'Unknown')))),
              group_separation: true,
            }}
            label="PCA Plot"
          />
        </div>
      </div>

      {/* Plain-language read */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border p-3.5" style={{ background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }}>
        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--dc-green)' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{read}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_220px]">
        {/* Scatter */}
        <div className="min-w-0">
          <ResponsiveContainer width="100%" height={440}>
            <ScatterChart margin={{ top: 16, right: 16, bottom: 56, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="x"
                name="PC1"
                label={{ value: xLabel, position: 'bottom', offset: 0, fill: 'var(--text-secondary)' }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                stroke="var(--border-strong)"
              />
              <YAxis
                type="number"
                dataKey="y"
                name="PC2"
                label={{ value: yLabel, angle: -90, position: 'left', fill: 'var(--text-secondary)' }}
                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                stroke="var(--border-strong)"
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border p-2 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.sample}</p>
                        {data.category && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedColorColumn}: {data.category}</p>}
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>PC1: {data.x.toFixed(2)}</p>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>PC2: {data.y.toFixed(2)}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px', color: 'var(--text-secondary)' }} />
              {uniqueCategories.length > 0 ? (
                uniqueCategories.map((cat) => (
                  <Scatter
                    key={cat as string}
                    name={cat as string}
                    data={(plotData as PCADataPoint[]).filter((d) => d.category === cat)}
                    fill={categoryColorMap[cat as string]}
                    shape={PcaDot}
                  />
                ))
              ) : (
                <Scatter name="Samples" data={pcaData.data} fill="var(--dc-indigo)" shape={PcaDot} />
              )}
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Variance rail */}
        <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-secondary)' }}>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>Variance explained</div>
          <div className="flex flex-col gap-2.5">
            {pcaData.explained_variance.slice(0, 6).map((v: number, i: number) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-[11.5px]">
                  <span style={{ color: 'var(--text-secondary)' }}>PC{i + 1}</span>
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{(v * 100).toFixed(1)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded" style={{ background: 'var(--n-100)' }}>
                  <div className="h-full rounded" style={{ width: `${Math.min(100, v * 100 * 3)}%`, background: i < 2 ? 'var(--sl-teal)' : 'var(--sl-purple)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Point renderer for the PCA scatter (typed to avoid `any`). */
function PcaDot(props: { cx?: number; cy?: number; fill?: string }) {
  return <circle cx={props.cx} cy={props.cy} r={5.5} fill={props.fill} fillOpacity={0.85} stroke="var(--surface)" strokeWidth={1} />;
}
