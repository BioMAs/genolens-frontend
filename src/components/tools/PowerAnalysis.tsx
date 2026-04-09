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
import { Calculator, TrendingUp, AlertCircle, Info } from 'lucide-react';

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

function powerColor(p: number) {
  if (p >= 0.8) return 'text-green-700';
  if (p >= 0.5) return 'text-yellow-700';
  return 'text-red-700';
}
function powerBorder(p: number) {
  if (p >= 0.8) return 'border-green-300 bg-green-50';
  if (p >= 0.5) return 'border-yellow-300 bg-yellow-50';
  return 'border-red-300 bg-red-50';
}

export default function PowerAnalysis() {
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-5 w-5 text-purple-600" />
          <h2 className="text-base font-semibold text-gray-900">Calculation mode</h2>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'sample-size'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
            onClick={() => setMode('sample-size')}
          >
            Calculate sample size
          </button>
          <button
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'power'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
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
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Test type</h3>
            <select
              value={testType}
              onChange={(e) => setTestType(e.target.value as TestType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="h-4 w-4 accent-purple-600 rounded"
              />
              <span className="text-sm text-gray-600">Two-tailed test (recommended)</span>
            </label>
          </div>

          {/* Alpha */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Significance threshold α
            </label>
            <p className="text-xs text-gray-400 mb-2">Type I error risk (false positive)</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {ALPHA_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAlpha(a)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                    alpha === a
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Effect size */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <label className="text-sm font-semibold text-gray-700 block mb-1">
              Effect size (Cohen&apos;s d)
            </label>
            <p className="text-xs text-gray-400 mb-2">Standardized difference between groups</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {EFFECT_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setEffectSize(p.value)}
                  title={p.desc}
                  className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors ${
                    effectSize === p.value
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
            />
            <input
              type="range"
              value={effectSize}
              onChange={(e) => setEffectSize(parseFloat(e.target.value))}
              min={0.1}
              max={2}
              step={0.05}
              className="w-full accent-purple-600"
            />
          </div>

          {/* Power target (mode: sample-size) */}
          {mode === 'sample-size' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Target power (1 – β)
              </label>
              <p className="text-xs text-gray-400 mb-2">Probability of detecting a real effect</p>
              <div className="flex gap-2 flex-wrap mb-2">
                {POWER_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTargetPower(p)}
                    className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                      targetPower === p
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
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
                className="w-full accent-purple-600"
              />
              <p className="text-center text-sm font-semibold text-purple-700 mt-1">
                {(targetPower * 100).toFixed(0)}%
              </p>
            </div>
          )}

          {/* n input (mode: power) */}
          {mode === 'power' && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                {testType === 'two-sample' ? 'n per group' : "Sample size (n)"}
              </label>
              <input
                type="number"
                value={sampleSizeInput}
                onChange={(e) => setSampleSizeInput(parseInt(e.target.value) || 10)}
                min={2}
                max={10000}
                step={1}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
              />
              <input
                type="range"
                value={Math.min(sampleSizeInput, 200)}
                onChange={(e) => setSampleSizeInput(parseInt(e.target.value))}
                min={2}
                max={200}
                step={1}
                className="w-full accent-purple-600"
              />
            </div>
          )}

          {/* RNA-seq converter */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <button
              onClick={() => setShowConverter(!showConverter)}
              className="flex items-center gap-2 text-sm font-semibold text-purple-700 hover:text-purple-900 w-full text-left"
            >
              <Info className="h-4 w-4 shrink-0" />
              RNA-seq → Cohen&apos;s d converter
            </button>
            {showConverter && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">
                  Formula: d = |log₂(FC)| / CV, where CV is the intra-group coefficient
                  of variation (standard deviation / mean of normalized counts).
                </p>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Expected fold change (FC)</label>
                  <input
                    type="number"
                    value={foldChange}
                    onChange={(e) => setFoldChange(parseFloat(e.target.value) || 2)}
                    min={1.01}
                    step={0.1}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">
                    Coefficient de variation (CV)
                  </label>
                  <input
                    type="number"
                    value={cv}
                    onChange={(e) => setCv(parseFloat(e.target.value) || 0.3)}
                    min={0.01}
                    step={0.05}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {computedD !== null && (
                  <div className="flex items-center justify-between bg-purple-50 rounded-md px-3 py-2">
                    <span className="text-xs text-purple-700">Estimated Cohen&apos;s d:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-purple-800">
                        {computedD.toFixed(3)}
                      </span>
                      <button
                        onClick={() =>
                          setEffectSize(Math.round((computedD ?? 0.5) * 100) / 100)
                        }
                        className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded hover:bg-purple-700 transition-colors"
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
              className={`rounded-lg border-2 p-6 ${powerBorder(result.power)}`}
            >
              <div className="flex items-center gap-3 mb-5">
                <TrendingUp className={`h-6 w-6 ${powerColor(result.power)}`} />
                <h3 className="text-lg font-bold text-gray-900">Results</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-5">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                    {testType === 'two-sample' ? 'n per group' : "Sample size"}
                  </div>
                  <div className="text-5xl font-extrabold text-gray-900">{result.n}</div>
                  {testType === 'two-sample' && (
                    <div className="text-xs text-gray-400 mt-1">
                      Total: {result.n * 2} participants
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                    Power
                  </div>
                  <div className={`text-5xl font-extrabold ${powerColor(result.power)}`}>
                    {(result.power * 100).toFixed(1)}%
                  </div>
                  <div className={`text-xs mt-1 font-medium ${powerColor(result.power)}`}>
                    {result.power >= 0.8
                      ? '✓ Adequate'
                      : result.power >= 0.5
                      ? '⚠ Insufficient'
                      : '✗ Very low'}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-4 grid grid-cols-4 gap-2 text-center text-xs text-gray-500">
                <div>
                  <span className="font-semibold text-gray-700">α</span> = {alpha}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">d</span> = {effectSize.toFixed(2)}
                </div>
                <div>
                  <span className="font-semibold text-gray-700">β</span> ={' '}
                  {((1 - result.power) * 100).toFixed(1)}%
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Test</span>{' '}
                  {twoTailed ? '2-tail' : '1-tail'}
                </div>
              </div>
            </div>
          )}

          {/* Power curve */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <h3 className="text-sm font-semibold text-gray-700">Power curve</h3>
              <span className="text-xs text-gray-400">
                — α = {alpha}, d = {effectSize.toFixed(2)}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={270}>
              <LineChart
                data={curveData}
                margin={{ top: 8, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="n"
                  label={{
                    value: testType === 'two-sample' ? 'n per group' : 'n',
                    position: 'insideBottom',
                    offset: -12,
                    fontSize: 11,
                  }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[0, 1]}
                  tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(val: any) => [
                    typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : String(val ?? ''),
                    'Power',
                  ]}
                  labelFormatter={(label) =>
                    testType === 'two-sample'
                      ? `n = ${label} per group`
                      : `n = ${label}`
                  }
                />
                <ReferenceLine
                  y={0.8}
                  stroke="#16a34a"
                  strokeDasharray="5 3"
                  label={{ value: '80%', fill: '#16a34a', fontSize: 10, position: 'right' }}
                />
                <ReferenceLine
                  y={0.9}
                  stroke="#0284c7"
                  strokeDasharray="5 3"
                  label={{ value: '90%', fill: '#0284c7', fontSize: 10, position: 'right' }}
                />
                {result && result.n <= 200 && (
                  <ReferenceLine
                    x={result.n}
                    stroke="#9333ea"
                    strokeDasharray="4 2"
                    label={{
                      value: `n=${result.n}`,
                      fill: '#9333ea',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="#9333ea"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Interpretation guide */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700">Interpretation guide</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-red-50 rounded-md p-3 border border-red-100">
                <p className="font-semibold text-red-700 mb-1">Low (&lt; 50%)</p>
                <p className="text-red-600">
                  High risk of missing a real effect. Review the study design.
                </p>
              </div>
              <div className="bg-yellow-50 rounded-md p-3 border border-yellow-100">
                <p className="font-semibold text-yellow-700 mb-1">Moderate (50 – 79%)</p>
                <p className="text-yellow-600">
                  Acceptable but sub-optimal. Increase n if possible.
                </p>
              </div>
              <div className="bg-green-50 rounded-md p-3 border border-green-100">
                <p className="font-semibold text-green-700 mb-1">Adequate (≥ 80%)</p>
                <p className="text-green-600">
                  Recommended standard. 90% is desirable for critical studies.
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
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
