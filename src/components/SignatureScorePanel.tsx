'use client';

import { useMemo, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import { useGeneLists } from '@/hooks/useBookmarks';
import { useSignatureScore, type ScoringMethod, type SampleScore } from '@/hooks/useSignatureScore';
import { getPalette } from '@/utils/chartPalettes';

interface SignatureScorePanelProps {
  projectId: string;
  matrixDatasetId: string;
  samples?: string[];
  sampleConditionMap?: Record<string, string>;
  /**
   * Genes to start from, e.g. the pathway being looked through on this screen.
   *
   * The panel had no way to receive a gene list at all — only its own picker and paste box —
   * so a pathway a scroll above could not become a signature without retyping it.
   */
  initialGenes?: string[];
  /** Names where those genes came from, so the pre-filled box is not mysterious. */
  initialLabel?: string;
}

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtP(p: number | null): string {
  if (p === null || p === undefined || Number.isNaN(p)) return '—';
  if (p < 1e-3) return p.toExponential(2);
  return p.toFixed(4);
}

// Deterministic jitter in [-0.3, 0.3] from a string (avoids Math.random re-render churn).
function jitter(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xffff;
  return ((h % 1000) / 1000 - 0.5) * 0.6;
}

export default function SignatureScorePanel({
  projectId,
  matrixDatasetId,
  samples,
  sampleConditionMap,
  initialGenes,
  initialLabel,
}: SignatureScorePanelProps) {
  const { data: geneLists } = useGeneLists(projectId);
  const { loading, result, error, run } = useSignatureScore(matrixDatasetId);

  // Opens on the pasted-genes tab when a caller supplied some, so what arrived is visible.
  const [source, setSource] = useState<'list' | 'paste'>(
    initialGenes && initialGenes.length > 0 ? 'paste' : 'list'
  );
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [pasted, setPasted] = useState(() => (initialGenes ?? []).join('\n'));

  /**
   * Adopt a new incoming list, without stamping on edits.
   *
   * Reconciled during render rather than in an effect: an effect would overwrite whatever the
   * reader had typed on the render after they typed it. Keyed on the incoming genes, so it only
   * fires when the *source* changes — a different pathway, not a keystroke.
   */
  const incomingKey = (initialGenes ?? []).join('|');
  const [lastIncoming, setLastIncoming] = useState(incomingKey);
  if (lastIncoming !== incomingKey) {
    setLastIncoming(incomingKey);
    if (incomingKey) {
      setPasted((initialGenes ?? []).join('\n'));
      setSource('paste');
    }
  }
  const [method, setMethod] = useState<ScoringMethod>('mean_z');

  const pastedGenes = useMemo(
    () => pasted.split(/[\s,;]+/).map((g) => g.trim()).filter(Boolean),
    [pasted]
  );

  const canRun =
    !loading &&
    ((source === 'list' && !!selectedListId) || (source === 'paste' && pastedGenes.length > 0));

  const handleRun = () => {
    run({
      geneListId: source === 'list' ? selectedListId : undefined,
      genes: source === 'paste' ? pastedGenes : undefined,
      method,
      samples,
      sampleConditionMap,
    });
  };

  const palette = getPalette('standard').categorical;

  // Build strip-plot data: x = group index + jitter, y = score.
  const chart = useMemo(() => {
    if (!result) return null;
    const groups = Object.keys(result.groups);
    const groupIndex = new Map(groups.map((g, i) => [g, i]));
    const byGroup: Record<string, { x: number; y: number; sample: string }[]> = {};
    for (const g of groups) byGroup[g] = [];
    for (const s of result.scores) {
      const g = s.group ?? 'unassigned';
      if (!(g in byGroup)) continue;
      byGroup[g].push({ x: (groupIndex.get(g) ?? 0) + jitter(s.sample), y: s.score, sample: s.sample });
    }
    const medians = groups.map((g, i) => ({ x: i, y: median(result.groups[g]) }));
    return { groups, byGroup, medians };
  }, [result]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-surface border border-line rounded-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-heading text-primary">Signature scoring</h2>
        </div>
        <p className="text-body-sm text-secondary mb-4">
          Score a custom gene signature across every sample, then compare scores between conditions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Source */}
          <div className="md:col-span-2">
            <div className="inline-flex rounded-lg border border-line bg-surface-2 p-1 mb-3">
              <button
                onClick={() => setSource('list')}
                className={`px-3 py-1 text-body-sm font-medium rounded-md ${
                  source === 'list' ? 'bg-surface shadow-sm text-primary' : 'text-secondary'
                }`}
              >
                Saved gene list
              </button>
              <button
                onClick={() => setSource('paste')}
                className={`px-3 py-1 text-body-sm font-medium rounded-md ${
                  source === 'paste' ? 'bg-surface shadow-sm text-primary' : 'text-secondary'
                }`}
              >
                Paste genes
              </button>
            </div>

            {/* Says where a pre-filled list came from, so it is not mysterious. */}
            {initialLabel && source === 'paste' && pastedGenes.length > 0 ? (
              <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
                Pre-filled from <strong>{initialLabel}</strong> —{' '}
                {pastedGenes.length.toLocaleString('en-US')} gene
                {pastedGenes.length === 1 ? '' : 's'}. Edit freely.
              </p>
            ) : null}

            {source === 'list' ? (
              <select
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-md text-body-sm"
              >
                <option value="">Select a gene list…</option>
                {(geneLists ?? []).map((gl) => (
                  <option key={gl.id} value={gl.id}>
                    {gl.name} ({gl.gene_count} genes)
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste gene symbols separated by spaces, commas, or newlines…"
                rows={4}
                className="w-full px-3 py-2 border border-strong rounded-md text-body-sm font-mono"
              />
            )}
            {source === 'paste' && (
              <p className="mt-1 text-caption text-secondary">{pastedGenes.length} genes parsed</p>
            )}
          </div>

          {/* Method + run */}
          <div className="space-y-3">
            <div>
              <label className="block text-body-sm font-medium text-primary mb-1">Scoring method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ScoringMethod)}
                className="w-full px-3 py-2 border border-strong rounded-md text-body-sm"
              >
                <option value="mean_z">Mean z-score (recommended)</option>
                <option value="mean_rank">Mean rank (AUCell-like)</option>
              </select>
            </div>
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md text-body-sm font-medium text-on-accent bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {loading ? 'Scoring…' : 'Score signature'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-body-sm">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && chart && (
        <div className="bg-surface border border-line rounded-lg p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
            <h3 className="text-title text-primary">
              Score by condition{result.signature_name ? ` — ${result.signature_name}` : ''}
            </h3>
            <div className="text-body-sm text-secondary">
              {result.test ? (
                <>
                  <span className="font-medium">{result.test}</span>: p = {fmtP(result.pvalue)}
                </>
              ) : (
                <span className="text-muted">No between-group test (need ≥2 groups with ≥2 samples)</span>
              )}
            </div>
          </div>

          <p className="text-caption text-secondary mb-3">
            {result.n_genes_used}/{result.n_genes_requested} signature genes found · {result.n_samples} samples ·
            method: {result.method === 'mean_z' ? 'mean z-score' : 'mean rank'}
          </p>

          <ResponsiveContainer width="100%" height={420}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 40, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[-0.5, chart.groups.length - 0.5]}
                ticks={chart.groups.map((_, i) => i)}
                tickFormatter={(v: number) => chart.groups[v] ?? ''}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <YAxis
                type="number"
                dataKey="y"
                tick={{ fontSize: 12 }}
                label={{
                  value: result.method === 'mean_z' ? 'Signature score (z)' : 'Signature score (rank)',
                  angle: -90,
                  position: 'left',
                  offset: -5,
                  fontSize: 12,
                }}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0].payload as { sample?: string; y: number };
                  if (!p.sample) return null;
                  return (
                    <div className="bg-surface border border-line rounded shadow px-3 py-2 text-caption">
                      <div className="font-semibold text-primary">{p.sample}</div>
                      <div>score: {p.y.toFixed(3)}</div>
                    </div>
                  );
                }}
              />
              {chart.groups.map((g, i) => (
                <Scatter
                  key={g}
                  name={g}
                  data={chart.byGroup[g]}
                  fill={palette[i % palette.length]}
                  fillOpacity={0.75}
                  isAnimationActive={false}
                />
              ))}
              {/* Median markers */}
              <Scatter
                name="Median"
                data={chart.medians}
                fill="#111827"
                shape="cross"
                isAnimationActive={false}
              />
            </ScatterChart>
          </ResponsiveContainer>

          {/* Group summary */}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-body-sm">
              <thead>
                <tr className="text-left text-secondary">
                  <th className="px-3 py-2 font-medium">Condition</th>
                  <th className="px-3 py-2 font-medium">n</th>
                  <th className="px-3 py-2 font-medium">Median score</th>
                </tr>
              </thead>
              <tbody>
                {chart.groups.map((g) => (
                  <tr key={g} className="border-t border-subtle">
                    <td className="px-3 py-1.5 font-medium text-primary">{g}</td>
                    <td className="px-3 py-1.5">{result.groups[g].length}</td>
                    <td className="px-3 py-1.5">{median(result.groups[g]).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
