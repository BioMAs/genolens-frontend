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
import { CHART_AXIS } from '@/components/charts/rechartsDefaults';
import { CHART_VARS, useChartPalette } from '@/utils/chartTheme';
import type { Palette } from '@/utils/chartPalettes';
import { mixColors } from '@/utils/chartScales';
import ChartCard from '@/components/charts/ChartCard';

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

/**
 * Rampe d'enrichissement : du gris de recul vers la couleur de serie.
 *
 * Elle interpolait indigo-200 → indigo-700, codes en dur canal par canal —
 * l'accent INTERACTIF du produit employe comme couleur de donnee, et une rampe
 * claire servie telle quelle sur panneau sombre. Partir de `palette.ns`, bas en
 * contraste dans les deux themes, fait reculer le faible enrichissement au lieu
 * de l'eclaircir arbitrairement.
 */
function ratioColor(enrichmentRatio: number, maxRatio: number, palette: Palette): string {
  const t = maxRatio > 0 ? Math.min(enrichmentRatio / maxRatio, 1) : 0;
  return mixColors(palette.ns, palette.categorical[0], t);
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
    <div className="bg-raised rounded-control shadow-elev-2 p-3 text-xs max-w-64">
      <div className="font-semibold text-primary mb-1 leading-snug">{d.name}</div>
      <div className="text-accent-ink mb-2">{d.go_id}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-secondary">
        <span>FDR</span><span className="font-semibold text-accent-ink">{d.fdr.toExponential(2)}</span>
        <span>-log₁₀(FDR)</span><span className="font-semibold">{d.value.toFixed(2)}</span>
        <span>Enrichment</span><span className="font-semibold">{d.enrichment_ratio.toFixed(2)}×</span>
        <span>Genes</span><span className="font-semibold">{d.gene_count}</span>
      </div>
    </div>
  );
}

export default function EnrichmentHistogram({ terms, maxTerms = 20 }: EnrichmentHistogramProps) {
  const palette = useChartPalette();
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
    <ChartCard
      title={`Top ${top.length} enriched terms`}
      subtitle="Colour = enrichment ratio · Length = −log₁₀(FDR)"
      state={terms.length ? 'ready' : 'empty'}
      minHeight={220}
      empty="No enriched terms to display."
      actions={
        <span className="flex items-center gap-2 text-caption text-muted">
          <span
            className="inline-block h-3 w-10 rounded-sm"
            // La rampe de legende reprenait indigo-200 → indigo-700, soit
            // l'accent INTERACTIF employe comme couleur de donnee.
            style={{ background: `linear-gradient(to right, ${palette.ns}, ${palette.categorical[0]})` }}
          />
          <span>Low → High enrichment</span>
        </span>
      }
    >
      <ResponsiveContainer width="100%" height={Math.max(220, top.length * 28)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_VARS.grid} />
          <XAxis
            type="number"
            domain={[0, xMax]}
            {...CHART_AXIS}
            label={{ value: '-log₁₀(FDR)', position: 'insideBottom', offset: -2, fontSize: 10, fill: CHART_VARS.inkMuted }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={200}
            {...CHART_AXIS}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_VARS.hover }} />
          <ReferenceLine
            x={LOG10_THRESHOLD}
            stroke={CHART_VARS.axis}
            strokeDasharray="4 2"
            label={{ value: 'FDR 0.05', position: 'top', fontSize: 9, fill: CHART_VARS.accent }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} maxBarSize={18}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={ratioColor(entry.enrichment_ratio, maxRatio, palette)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
