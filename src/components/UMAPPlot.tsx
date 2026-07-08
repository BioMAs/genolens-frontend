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
import { useUMAPData } from '@/hooks/useVisualizations';
import api from '@/utils/api';
import { Dataset } from '@/types';
import { getPalette } from '@/utils/chartPalettes';
import ColorblindToggle from '@/components/ui/ColorblindToggle';
import AIChartAssistant from '@/components/AIChartAssistant';

interface UMAPPlotProps {
  dataset: Dataset;
  metadataDataset?: Dataset;
}

type MetadataValue = string | number | boolean | null;
type MetadataRow = Record<string, MetadataValue>;

interface UmapDataPoint {
  sample: string;
  x: number;
  y: number;
  z?: number;
  cluster?: string | number;
  category?: MetadataValue;
}

interface UmapDataResponse {
  data: UmapDataPoint[];
}

export default function UMAPPlot({ dataset, metadataDataset }: UMAPPlotProps) {
  // Utilise React Query pour gérer le cache UMAP
  const { data: umapData, isLoading, error: umapError } = useUMAPData(
    dataset.id,
    {},
    dataset.status === 'READY'
  );
  const typedUmapData = umapData as UmapDataResponse | undefined;
  
  const [metadata, setMetadata] = useState<MetadataRow[]>([]);
  const [metadataColumns, setMetadataColumns] = useState<string[]>([]);
  const [selectedColorColumn, setSelectedColorColumn] = useState<string>('');
  const [colorblindMode, setColorblindMode] = useState(false);
  const palette = getPalette(colorblindMode ? 'colorblind' : 'standard');
  const [joinColumn, setJoinColumn] = useState<string>('');

  const error = umapError 
    ? (umapError instanceof Error && umapError.message.includes('UMAP is not installed')
      ? 'UMAP is not available on the server. Please install umap-learn.'
      : 'Failed to calculate UMAP. Ensure the dataset is a valid expression matrix.')
    : null;

  // Fetch Metadata if available and UMAP is ready
  useEffect(() => {
    if (!metadataDataset || metadataDataset.status !== 'READY') {
        // Intentional reset when metadata is unavailable.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMetadata([]);
        setMetadataColumns([]);
        setJoinColumn('');
        setSelectedColorColumn('');
        return;
    }

    const fetchMetadata = async () => {
      if (!typedUmapData) return;

      try {
        const resp = await api.post(`/datasets/${metadataDataset.id}/query`, {
          limit: 1000 // Assume < 1000 samples
        });
        const metaData = resp.data.data as MetadataRow[];
        setMetadata(metaData);
        
        const cols = resp.data.columns as string[];

        // 1. Find the best column to join on (Sample ID)
        const umapSamples = new Set(typedUmapData.data.map((d) => d.sample));
        let bestJoinCol = '';
        let maxOverlap = 0;

        cols.forEach((col: string) => {
            const metaValues = metaData.map((row) => row[col]);
            const overlap = metaValues.filter((v) => umapSamples.has(String(v))).length;
            if (overlap > maxOverlap) {
                maxOverlap = overlap;
                bestJoinCol = col;
            }
        });
        setJoinColumn(bestJoinCol);

        // 2. Filter columns suitable for coloring (categorical, < 20 unique values)
        const suitableCols = cols.filter((col: string) => {
            if (col === bestJoinCol) return false;
          const uniqueValues = new Set(metaData.map((row) => row[col]));
            return uniqueValues.size > 1 && uniqueValues.size < 20;
        });
        setMetadataColumns(suitableCols);
        if (suitableCols.length > 0 && (!selectedColorColumn || !suitableCols.includes(selectedColorColumn))) {
            setSelectedColorColumn(suitableCols[0]);
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };

    fetchMetadata();
  }, [metadataDataset, typedUmapData, selectedColorColumn]);

  // Merge UMAP with Metadata
  const plotData: UmapDataPoint[] = useMemo(() => {
    if (!typedUmapData) {
      return [];
    }
    if (!selectedColorColumn || metadata.length === 0 || !joinColumn) {
      return typedUmapData.data;
    }
    return typedUmapData.data.map((point) => {
      const metaRow = metadata.find((m) => String(m[joinColumn]) === point.sample);
      return {
        ...point,
        category: metaRow ? metaRow[selectedColorColumn] : 'Unknown'
      };
    });
  }, [typedUmapData, selectedColorColumn, metadata, joinColumn]);

  // Generate Colors
  const uniqueCategories = useMemo(() => {
      if (!selectedColorColumn) return [];
      return Array.from(new Set(plotData.map((d) => d.category))).filter(Boolean);
  }, [plotData, selectedColorColumn]);

  const categoryColorMap = useMemo(() => {
      const map: Record<string, string> = {};
      uniqueCategories.forEach((cat, i) => {
          map[cat as string] = palette.categorical[i % palette.categorical.length];
      });
      map['Unknown'] = '#d1d5db';
      return map;
  }, [uniqueCategories, palette]);

  if (isLoading) return <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--text-secondary)' }}>Calculating UMAP…</div>;
  if (error) return <div className="flex h-64 items-center justify-center p-4 text-center text-sm" style={{ color: 'var(--sl-red-dark)' }}>{error}</div>;
  if (!typedUmapData) return null;

  const nSamples = typedUmapData.data.length;
  const read = `A non-linear projection of ${nSamples} samples${selectedColorColumn ? `, coloured by ${selectedColorColumn}` : ''}. Points that sit close together have similar overall expression.`;

  return (
    <div className="gl-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Sample UMAP</h3>
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
            chartType="umap"
            contextKey="umap-default"
            context={{
              n_samples: nSamples,
              n_clusters: Array.from(new Set(plotData.map((d) => d.cluster ?? 0))).length,
              cluster_sizes: [],
              sample_groups: Array.from(new Set(plotData.map((d) => d.category ?? 'Unknown'))),
            }}
            label="UMAP"
          />
        </div>
      </div>

      {/* Plain-language read */}
      <div className="mb-4 flex items-start gap-2.5 rounded-xl border p-3.5" style={{ background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }}>
        <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: 'var(--dc-green)' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{read}</p>
      </div>

      <ResponsiveContainer width="100%" height={440}>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 56, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="x"
            name="UMAP1"
            label={{ value: 'UMAP 1', position: 'bottom', offset: 0, fill: 'var(--text-secondary)' }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            stroke="var(--border-strong)"
          />
          <YAxis
            type="number"
            dataKey="y"
            name="UMAP2"
            label={{ value: 'UMAP 2', angle: -90, position: 'left', fill: 'var(--text-secondary)' }}
            tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
            stroke="var(--border-strong)"
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload as UmapDataPoint;
                return (
                  <div className="rounded-lg border p-2 shadow-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.sample}</p>
                    {data.category && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selectedColorColumn}: {data.category}</p>}
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>UMAP1: {data.x.toFixed(2)}</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>UMAP2: {data.y.toFixed(2)}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px', color: 'var(--text-secondary)' }} />
          {uniqueCategories.length > 0 ? (
            uniqueCategories.map((cat) => (
              <Scatter key={cat as string} name={cat as string} data={plotData.filter((d) => d.category === cat)} fill={categoryColorMap[cat as string]} shape={UmapDot} />
            ))
          ) : (
            <Scatter name="Samples" data={typedUmapData.data} fill="var(--dc-indigo)" shape={UmapDot} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Point renderer for the UMAP scatter (typed to avoid `any`). */
function UmapDot(props: { cx?: number; cy?: number; fill?: string }) {
  return <circle cx={props.cx} cy={props.cy} r={5.5} fill={props.fill} fillOpacity={0.85} stroke="var(--surface)" strokeWidth={1} />;
}
