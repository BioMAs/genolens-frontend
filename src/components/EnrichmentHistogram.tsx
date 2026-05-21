'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface GOTerm {
  go_id: string;
  go_name: string;
  namespace: string;
  pvalue: number;
  fdr: number;
  enrichment_ratio: number;
  study_count: number;
  study_genes: string[];
  background_count: number;
  level?: number;
}

interface EnrichmentHistogramProps {
  terms: GOTerm[];
  maxTerms?: number;
}

const FDR_THRESHOLD = 0.05;
const LOG10_THRESHOLD = -Math.log10(FDR_THRESHOLD); // ≈ 1.301

function fdrColor(enrichmentRatio: number, maxRatio: number): string {
  // Indigo scale: low enrichment → light, high → dark
  const t = maxRatio > 0 ? Math.min(enrichmentRatio / maxRatio, 1) : 0;
  const r = Math.round(199 - t * (199 - 67));
  const g = Math.round(210 - t * (210 - 56));
  const b = Math.round(254 - t * (254 - 202));
  return `rgb(${r},${g},${b})`;
}

interface ChartEntry {
  name: string;
  go_id: string;
  value: number;
  enrichment_ratio: number;
  fdr: number;
  gene_count: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartEntry }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs max-w-64">
      <div className="font-semibold text-gray-900 mb-1 leading-snug">{d.name}</div>
      <div className="text-indigo-500 mb-2">{d.go_id}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600">
        <span>FDR</span><span className="font-semibold text-indigo-700">{d.fdr.toExponential(2)}</span>
        <span>-log₁₀(FDR)</span><span className="font-semibold">{d.value.toFixed(2)}</span>
        <span>Enrichment</span><span className="font-semibold">{d.enrichment_ratio.toFixed(2)}×</span>
        <span>Genes</span><span className="font-semibold">{d.gene_count}</span>
      </div>
    </div>
  );
}

export default function EnrichmentHistogram({ terms, maxTerms = 20 }: EnrichmentHistogramProps) {
  if (!terms.length) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        No enriched terms to display.
      </div>
    );
  }

  // Top N by FDR ascending, then reverse so most significant is at top
  const top = [...terms]
    .sort((a, b) => a.fdr - b.fdr)
    .slice(0, maxTerms)
    .reverse();

  const maxRatio = Math.max(...top.map(t => t.enrichment_ratio));

  const data: ChartEntry[] = top.map(t => ({
    name: t.go_name.length > 45 ? t.go_name.slice(0, 42) + '…' : t.go_name,
    go_id: t.go_id,
    value: -Math.log10(t.fdr),
    enrichment_ratio: t.enrichment_ratio,
    fdr: t.fdr,
    gene_count: t.study_count,
  }));

  const maxValue = Math.max(...data.map(d => d.value));
  const xMax = Math.ceil(maxValue) + 0.5;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs font-semibold text-gray-700">Top {top.length} Enriched Terms</span>
          <span className="text-xs text-muted-foreground ml-2">Color = enrichment ratio · Length = -log₁₀(FDR)</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block w-10 h-3 rounded" style={{ background: 'linear-gradient(to right, rgb(199,210,254), rgb(67,56,202))' }} />
          <span>Low → High enrichment</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(220, top.length * 28)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis
            type="number"
            domain={[0, xMax]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            label={{ value: '-log₁₀(FDR)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: '#374151' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <ReferenceLine
            x={LOG10_THRESHOLD}
            stroke="#6366f1"
            strokeDasharray="4 2"
            label={{ value: 'FDR 0.05', position: 'top', fontSize: 9, fill: '#6366f1' }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={fdrColor(entry.enrichment_ratio, maxRatio)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
