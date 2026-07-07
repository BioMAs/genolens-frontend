'use client';

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChatFigureData } from '@/hooks/useChatAgent';
import { getPalette } from '@/utils/chartPalettes';

interface VolcanoPoint {
  x: number;
  y: number;
  gene: string;
  padj: number;
  is_significant: boolean;
}

/**
 * Renders an inline figure produced by the chat agent. The payload is the exact
 * JSON the corresponding REST endpoint returns, so the shapes match the app's
 * existing plot components. New figure types are added to the switch below.
 */
export default function ChatFigure({ figure }: { figure: ChatFigureData }) {
  if (figure.figure_type === 'volcano') {
    return <VolcanoFigure payload={figure.payload} params={figure.params} />;
  }
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
      Figure type “{figure.figure_type}” is not renderable yet.
    </div>
  );
}

function VolcanoFigure({
  payload,
  params,
}: {
  payload: Record<string, unknown>;
  params: Record<string, unknown>;
}) {
  const points = (payload.points as VolcanoPoint[]) ?? [];
  const totalGenes = (payload.total_genes as number) ?? points.length;
  const sigGenes = (payload.significant_genes as number) ?? 0;
  const palette = getPalette('standard');
  const logfcThreshold = Number(params.logfc_threshold ?? 0.58);

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)]">
        No data points returned for this volcano plot.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[var(--text-primary)]">Volcano plot</h4>
        <span className="text-[11px] text-[var(--text-muted)]">
          {sigGenes} significant / {totalGenes} genes
        </span>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 12, bottom: 24, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis
              type="number"
              dataKey="x"
              name="log2FC"
              tick={{ fontSize: 11 }}
              label={{ value: 'log2 fold-change', position: 'insideBottom', offset: -12, fontSize: 11 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="-log10(padj)"
              tick={{ fontSize: 11 }}
              label={{ value: '-log10(padj)', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <ReferenceLine x={logfcThreshold} stroke="var(--text-muted)" strokeDasharray="4 4" />
            <ReferenceLine x={-logfcThreshold} stroke="var(--text-muted)" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={({ payload: tp }) => {
                const p = tp?.[0]?.payload as VolcanoPoint | undefined;
                if (!p) return null;
                return (
                  <div className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-[11px]">
                    <div className="font-semibold">{p.gene}</div>
                    <div>log2FC: {p.x.toFixed(2)}</div>
                    <div>padj: {p.padj.toExponential(2)}</div>
                  </div>
                );
              }}
            />
            <Scatter data={points} isAnimationActive={false}>
              {points.map((p, i) => (
                <Cell
                  key={i}
                  fill={p.is_significant ? (p.x >= 0 ? palette.up : palette.down) : palette.ns}
                  fillOpacity={p.is_significant ? 0.85 : 0.4}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
