'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Calculator, TrendingUp, AlertCircle, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHART_AXIS, CHART_GRID, CHART_TOOLTIP_CURSOR, ChartTooltip } from '@/components/charts/rechartsDefaults';
import {CHART_VARS, useChartPalette } from '@/utils/chartTheme';
import { cn } from '@/lib/cn';

// ============================================================================
// Statistical utility functions (normal approximation – sufficient for planning)
// ============================================================================

/** Cumulative Normal Distribution (Abramowitz & Stegun 26.2.17) */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const result = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? result : 1 - result;
}

/** Inverse Normal CDF – Peter Acklam's rational approximation */
function normalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [
    -3.969683028665376e1, 2.20946098424520e2, -2.75928510446969e2,
    1.38357751867269e2, -3.06647980661472e1, 2.50662827745924,
  ];
  const b = [
    -5.44760987982241e1, 1.61585836858041e2, -1.55698979859887e2,
    6.68013118877197e1, -1.32806815528857e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

type TestType = 'two-sample' | 'paired' | 'one-sample';

/** Power given n per group (or n total for one-sample/paired) */
function calcPower(
  alpha: number,
  n: number,
  d: number,
  testType: TestType,
  twoTailed: boolean,
): number {
  const za = normalInv(twoTailed ? 1 - alpha / 2 : 1 - alpha);
  const delta = testType === 'two-sample' ? d * Math.sqrt(n / 2) : d * Math.sqrt(n);
  if (twoTailed) {
    return normalCDF(delta - za) + normalCDF(-delta - za);
  }
  return normalCDF(delta - za);
}

/** Sample size per group (or total for one-sample/paired) to achieve target power */
function calcSampleSize(
  alpha: number,
  power: number,
  d: number,
  testType: TestType,
  twoTailed: boolean,
): number {
  const za = normalInv(twoTailed ? 1 - alpha / 2 : 1 - alpha);
  const zb = normalInv(power);
  const base = ((za + zb) / d) ** 2;
  return Math.ceil(testType === 'two-sample' ? 2 * base : base);
}

// ============================================================================
// Component
// ============================================================================

type Mode = 'sample-size' | 'power';

const ALPHA_PRESETS = [0.001, 0.01, 0.05, 0.1];
const POWER_PRESETS = [0.7, 0.8, 0.9, 0.95];
const EFFECT_PRESETS = [
  { label: 'Small (0.2)', value: 0.2, desc: 'Barely perceptible effect' },
  { label: 'Medium (0.5)', value: 0.5, desc: 'Moderate effect' },
  { label: 'Large (0.8)', value: 0.8, desc: 'Large effect' },
];

/** Verdict de puissance : succes / avertissement / danger. */
type PowerLevel = 'adequate' | 'insufficient' | 'low';

function powerLevel(p: number): PowerLevel {
  if (p >= 0.8) return 'adequate';
  if (p >= 0.5) return 'insufficient';
  return 'low';
}

// Les fonds clairs precedents (bg-green-50 / bg-yellow-50 / bg-red-50) n'avaient
// pas de variante sombre : la carte de resultat restait un panneau clair pose
// sur le theme sombre. Les tokens semantiques resolvent dans les deux themes.
const POWER_STYLES: Record<PowerLevel, { text: string; panel: string; label: string; Icon: LucideIcon }> = {
  adequate:     { text: 'text-success', panel: 'border-success/30 bg-success-soft', label: 'Adequate',     Icon: CheckCircle2 },
  insufficient: { text: 'text-warning', panel: 'border-warning/30 bg-warning-soft', label: 'Insufficient', Icon: AlertTriangle },
  low:          { text: 'text-danger',  panel: 'border-danger/30 bg-danger-soft',   label: 'Very low',     Icon: XCircle },
};

export default function PowerAnalysis() {
  const palette = useChartPalette();
  const [mode, setMode] = useState<Mode>('sample-size');
  const [testType, setTestType] = useState<TestType>('two-sample');
  const [twoTailed, setTwoTailed] = useState(true);
  const [alpha, setAlpha] = useState(0.05);
  const [targetPower, setTargetPower] = useState(0.8);
  const [effectSize, setEffectSize] = useState(0.5);
  const [sampleSizeInput, setSampleSizeInput] = useState(30);

  // RNA-seq fold-change → Cohen's d converter
  const [showConverter, setShowConverter] = useState(false);
  const [foldChange, setFoldChange] = useState(2.0);
  const [cv, setCv] = useState(0.3);

  const computedD = useMemo(() => {
    if (foldChange > 0 && cv > 0) {
      return Math.abs(Math.log2(foldChange)) / cv;
    }
    return null;
  }, [foldChange, cv]);

  // Main result
  const result = useMemo(() => {
    if (!effectSize || effectSize <= 0) return null;
    if (mode === 'sample-size') {
      const n = calcSampleSize(alpha, targetPower, effectSize, testType, twoTailed);
      const actualPower = calcPower(alpha, n, effectSize, testType, twoTailed);
      return { n, power: actualPower };
    } else {
      const power = calcPower(alpha, sampleSizeInput, effectSize, testType, twoTailed);
      return { n: sampleSizeInput, power };
    }
  }, [mode, testType, twoTailed, alpha, targetPower, effectSize, sampleSizeInput]);

  // Power curve (power vs n for current parameters)
  const curveData = useMemo(() => {
    if (!effectSize || effectSize <= 0) return [];
    return Array.from({ length: 100 }, (_, i) => {
      const n = (i + 1) * 2;
      return {
        n,
        power: Math.round(calcPower(alpha, n, effectSize, testType, twoTailed) * 1000) / 1000,
      };
    });
  }, [alpha, effectSize, testType, twoTailed]);

  return (
    <div className="space-y-6">
      {/* ── Mode toggle ── */}
      <div className="bg-surface rounded-card shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-5 w-5 text-accent-ink" />
          <h2 className="text-body font-semibold text-primary">Calculation mode</h2>
        </div>
        <div className="flex rounded-control border border-line overflow-hidden">
          <button
            className={cn(
              'flex-1 px-4 py-2 text-body-sm font-medium transition-colors',
              mode === 'sample-size' ? 'bg-accent text-on-accent' : 'bg-surface text-secondary hover:bg-hover',
            )}
            onClick={() => setMode('sample-size')}
          >
            Calculate sample size
          </button>
          <button
            className={cn(
              'flex-1 px-4 py-2 text-body-sm font-medium transition-colors',
              mode === 'power' ? 'bg-accent text-on-accent' : 'bg-surface text-secondary hover:bg-hover',
            )}
            onClick={() => setMode('power')}
          >
            Calculate power
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ══ LEFT: Parameters ══ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Test type */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <h3 className="text-body-sm font-semibold text-primary mb-3">Test type</h3>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as TestType)}
              className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="two-sample">t-test — two independent samples</option>
              <option value="paired">t-test — paired samples</option>
              <option value="one-sample">t-test — one sample</option>
            </select>
            <label className="mt-3 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={twoTailed}
                onChange={(e) => setTwoTailed(e.target.checked)}
                className="h-4 w-4 accent-accent rounded-sm"
              />
              <span className="text-body-sm text-secondary">Two-tailed test (recommended)</span>
            </label>
          </div>

          {/* Alpha */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <label className="text-body-sm font-semibold text-primary block mb-1">
              Significance threshold α
            </label>
            <p className="text-caption text-muted mb-2">Type I error risk (false positive)</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {ALPHA_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAlpha(a)}
                  className={cn(
                    'px-3 py-1 rounded-sm text-caption font-medium border transition-colors',
                    alpha === a ? 'bg-accent text-on-accent border-accent' : 'bg-surface text-secondary border-strong hover:bg-hover',
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value) || 0.05)}
              min={0.001}
              max={0.5}
              step={0.005}
              className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Effect size */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <label className="text-body-sm font-semibold text-primary block mb-1">
              Effect size (Cohen&apos;s d)
            </label>
            <p className="text-caption text-muted mb-2">Standardized difference between groups</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {EFFECT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setEffectSize(p.value)}
                  title={p.desc}
                  className={cn(
                    'px-2 py-1 rounded-sm text-caption font-medium border transition-colors',
                    effectSize === p.value ? 'bg-accent text-on-accent border-accent' : 'bg-surface text-secondary border-strong hover:bg-hover',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={effectSize}
              onChange={(e) => setEffectSize(parseFloat(e.target.value) || 0.5)}
              min={0.05}
              max={5}
              step={0.05}
              className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent mb-2"
            />
            <input
              type="range"
              value={effectSize}
              onChange={(e) => setEffectSize(parseFloat(e.target.value))}
              min={0.1}
              max={2}
              step={0.05}
              className="w-full accent-accent"
            />
          </div>

          {/* Power target (mode: sample-size) */}
          {mode === 'sample-size' && (
            <div className="bg-surface rounded-card shadow-sm p-4">
              <label className="text-body-sm font-semibold text-primary block mb-1">
                Target power (1 – β)
              </label>
              <p className="text-caption text-muted mb-2">Probability of detecting a real effect</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {POWER_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTargetPower(p)}
                    className={cn(
                      'px-3 py-1 rounded-sm text-caption font-medium border transition-colors',
                      targetPower === p ? 'bg-accent text-on-accent border-accent' : 'bg-surface text-secondary border-strong hover:bg-hover',
                    )}
                  >
                    {p * 100}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                value={targetPower}
                onChange={(e) => setTargetPower(parseFloat(e.target.value))}
                min={0.5}
                max={0.99}
                step={0.01}
                className="w-full accent-accent"
              />
              <p className="text-center text-body-sm font-semibold text-accent-ink mt-1">
                {(targetPower * 100).toFixed(0)}%
              </p>
            </div>
          )}

          {/* n input (mode: power) */}
          {mode === 'power' && (
            <div className="bg-surface rounded-card shadow-sm p-4">
              <label className="text-body-sm font-semibold text-primary block mb-1">
                {testType === 'two-sample' ? 'n per group' : "Sample size (n)"}
              </label>
              <input
                type="number"
                value={sampleSizeInput}
                onChange={(e) => setSampleSizeInput(parseInt(e.target.value) || 10)}
                min={2}
                max={10000}
                step={1}
                className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent mb-2"
              />
              <input
                type="range"
                value={Math.min(sampleSizeInput, 200)}
                onChange={(e) => setSampleSizeInput(parseInt(e.target.value))}
                min={2}
                max={200}
                step={1}
                className="w-full accent-accent"
              />
            </div>
          )}

          {/* RNA-seq converter */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <button
              onClick={() => setShowConverter(!showConverter)}
              className="flex items-center gap-2 text-body-sm font-semibold text-accent-ink hover:text-accent-ink w-full text-left"
            >
              <Info className="h-4 w-4 shrink-0" />
              RNA-seq → Cohen&apos;s d converter
            </button>
            {showConverter && (
              <div className="mt-3 space-y-3">
                <p className="text-caption text-secondary">
                  Formula: d = |log₂(FC)| / CV, where CV is the intra-group coefficient
                  of variation (standard deviation / mean of normalized counts).
                </p>
                <div>
                  <label className="text-caption text-secondary block mb-1">Expected fold change (FC)</label>
                  <input
                    type="number"
                    value={foldChange}
                    onChange={(e) => setFoldChange(parseFloat(e.target.value) || 2)}
                    min={1.01}
                    step={0.1}
                    className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="text-caption text-secondary block mb-1">
                    Coefficient of variation (CV)
                  </label>
                  <input
                    type="number"
                    value={cv}
                    onChange={(e) => setCv(parseFloat(e.target.value) || 0.3)}
                    min={0.01}
                    step={0.05}
                    className="w-full rounded-sm border border-strong px-3 py-2 text-body-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
                {computedD !== null && (
                  <div className="flex items-center justify-between bg-accent-soft rounded-sm px-3 py-2">
                    <span className="text-caption text-accent-ink">Estimated Cohen&apos;s d:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-body-sm font-bold text-accent-ink">
                        {computedD.toFixed(3)}
                      </span>
                      <button
                        onClick={() =>
                          setEffectSize(Math.round((computedD ?? 0.5) * 100) / 100)
                        }
                        className="text-caption bg-accent text-on-accent px-2 py-0.5 rounded-sm hover:bg-accent-hover transition-colors"
                      >
                        Use
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Results + Chart ══ */}
        <div className="lg:col-span-2 space-y-4">
          {/* Result card */}
          {result && (
            <div
              className={cn(
                'rounded-card border p-6',
                POWER_STYLES[powerLevel(result.power)].panel,
              )}
            >
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className={cn('h-6 w-6', POWER_STYLES[powerLevel(result.power)].text)} />
                <h3 className="text-title text-primary">Results</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="text-center">
                  <div className="text-caption uppercase tracking-widest text-secondary mb-1">
                    {testType === 'two-sample' ? 'n per group' : "Sample size"}
                  </div>
                  <div className="text-hero font-extrabold text-primary">{result.n}</div>
                  {testType === 'two-sample' && (
                    <div className="text-caption text-muted mt-1">
                      Total: {result.n * 2} participants
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-caption uppercase tracking-widest text-secondary mb-1">
                    Power
                  </div>
                  <div className={cn(
                         'text-hero font-extrabold',
                         POWER_STYLES[powerLevel(result.power)].text,
                       )}>
                    {(result.power * 100).toFixed(1)}%
                  </div>
                  {(() => {
                    // Glyphes ✓ / ⚠ / ✗ remplaces par des icones vectorielles :
                    // leur rendu dependait de la police et ne s'alignait pas
                    // sur le reste de l'iconographie (lucide).
                    const { text, label, Icon } = POWER_STYLES[powerLevel(result.power)];
                    return (
                      <div className={cn(
                             'mt-1 inline-flex items-center gap-1 text-caption font-medium',
                             text,
                           )}>
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                        {label}
                      </div>
                    );
                  })()}
                </div>
              </div>
              <div className="border-t border-line pt-4 grid grid-cols-4 gap-2 text-center text-caption text-secondary">
                <div>
                  <span className="font-semibold text-primary">α</span> = {alpha}
                </div>
                <div>
                  <span className="font-semibold text-primary">d</span> = {effectSize.toFixed(2)}
                </div>
                <div>
                  <span className="font-semibold text-primary">β</span> ={' '}
                  {((1 - result.power) * 100).toFixed(1)}%
                </div>
                <div>
                  <span className="font-semibold text-primary">Test</span>{' '}
                  {twoTailed ? '2-tail' : '1-tail'}
                </div>
              </div>
            </div>
          )}

          {/* Power curve */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-accent-ink" />
              <h3 className="text-body-sm font-semibold text-primary">Power curve</h3>
              <span className="text-caption text-muted">
                — α = {alpha}, d = {effectSize.toFixed(2)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={270}>
              <LineChart
                data={curveData}
                margin={{ top: 8, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid {...CHART_GRID} />
                <XAxis
                  dataKey="n"
                  label={{
                    value: testType === 'two-sample' ? 'n per group' : 'n',
                    position: 'insideBottom',
                    offset: -12,
                    fontSize: 11,
                  }}
                  {...CHART_AXIS}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  {...CHART_AXIS}
                />
                <Tooltip
                  content={<ChartTooltip />}
                  cursor={CHART_TOOLTIP_CURSOR}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [
                    typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : String(val ?? ''),
                    'Power',
                  ]} labelFormatter={(label) =>
                    testType === 'two-sample'
                      ? `n = ${label} per group`
                      : `n = ${label}`
                  } />
                <ReferenceLine
                  y={0.8}
                  stroke={CHART_VARS.axis}
                  strokeDasharray="5 3"
                  label={{ value: '80%', fill: CHART_VARS.up, fontSize: 10, position: 'right' }}
                />
                <ReferenceLine
                  y={0.9}
                  stroke={CHART_VARS.axis}
                  strokeDasharray="5 3"
                  label={{ value: '90%', fill: palette.categorical[1], fontSize: 10, position: 'right' }}
                />
                {result && result.n <= 200 && (
                  <ReferenceLine
                    x={result.n}
                    stroke={CHART_VARS.axis}
                    strokeDasharray="4 2"
                    label={{
                      value: `n=${result.n}`,
                      fill: palette.categorical[2],
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke={palette.categorical[2]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Interpretation guide */}
          <div className="bg-surface rounded-card shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-muted" />
              <h3 className="text-body-sm font-semibold text-primary">Interpretation guide</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-caption">
              <div className="bg-danger-soft rounded-sm p-3 border border-danger/30">
                <p className="font-semibold text-danger-ink mb-1">Low (&lt; 50%)</p>
                <p className="text-danger-ink">
                  High risk of missing a real effect. Review the study design.
                </p>
              </div>
              <div className="bg-warning-soft rounded-sm p-3 border border-warning/30">
                <p className="font-semibold text-warning-ink mb-1">Moderate (50 – 79%)</p>
                <p className="text-warning-ink">
                  Acceptable but sub-optimal. Increase n if possible.
                </p>
              </div>
              <div className="bg-success-soft rounded-sm p-3 border border-success/30">
                <p className="font-semibold text-success-ink mb-1">Adequate (≥ 80%)</p>
                <p className="text-success-ink">
                  Recommended standard. 90% is desirable for critical studies.
                </p>
              </div>
            </div>
            <p className="mt-3 text-caption text-muted">
              * These calculations are based on the normal approximation (z-test). For RNA-seq
              studies with multiple FDR corrections or mixed models, dedicated tools
              (RNASeqPower, PROPER, pwr in R) are recommended.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
