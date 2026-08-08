'use client';

/**
 * Les gènes de la comparaison qui figurent au classement, et le test qui dit si c'est notable.
 *
 * TROIS CHOSES QUE LE BANDEAU DOIT DIRE, et qui seraient toutes des chiffres trompeurs seules :
 *
 * 1. **Le sens du percentile.** genolens-dd le définit comme `position / n_ranked` depuis la
 *    tête, donc 0 % est le meilleur rang — l'inverse de la lecture spontanée. « Percentile moyen
 *    18 % » se lirait comme un mauvais résultat alors que c'est un très bon.
 * 2. **Le plancher de la p-value.** Elle est corrigée en `(1+k)/(1+n)` et ne peut pas descendre
 *    sous `1/(1+n)`. Afficher `0.001` sans dire que c'est la borne laisserait lire une mesure là
 *    où il y a une limite d'échantillonnage.
 * 3. **La graine.** Sans elle, deux exécutions donnent deux p-values et le chiffre n'est pas
 *    reproductible.
 *
 * Et quand `pvalue` est nul — aucun gène dans l'univers classé — **aucun chiffre n'est affiché**.
 * Un `p = —` posé à côté d'un percentile se lit comme un résultat non significatif alors qu'il
 * n'y a pas eu de test.
 */
import { useMemo, useState } from 'react';

import { DdSignatureResult, DdTarget } from '@/types/drugDiscovery';
import { axisNames, fmt } from './targetColumns';

interface SignatureHitsTableProps {
  result: DdSignatureResult;
  weights: Record<string, number>;
  /** Symbole → condition d'origine, pour la colonne Direction. */
  directionBySymbol: Record<string, 'UP' | 'DOWN'>;
  genesSentTotal: number;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900" title={hint}>
        {value}
      </dd>
    </div>
  );
}

export default function SignatureHitsTable({
  result,
  weights,
  directionBySymbol,
  genesSentTotal,
}: SignatureHitsTableProps) {
  const [sortBy, setSortBy] = useState<'rank' | 'percentile'>('rank');
  const axes = useMemo(() => axisNames(result.hits), [result.hits]);

  const rows: DdTarget[] = useMemo(() => {
    const copy = [...result.hits];
    copy.sort((a, b) =>
      sortBy === 'rank' ? a.rank - b.rank : a.percentile - b.percentile,
    );
    return copy;
  }, [result.hits, sortBy]);

  const atFloor =
    result.pvalue !== null && result.pvalue <= 1 / (1 + result.n_permutations);

  if (result.pvalue === null || result.mean_percentile === null) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-sm text-gray-700">
        <p className="font-medium text-gray-900">
          None of your genes is in the ranked universe for this indication.
        </p>
        <p className="mt-2">
          {result.n_resolved} gene(s) resolved, and {result.n_outside_universe} of them are
          excluded from the ranking by the safety floor, the common-essential rule, or a missing
          required axis. There is no enrichment test to report — not a non-significant one.
        </p>
      </div>
    );
  }

  return (
    <div>
      <dl className="mb-4 grid grid-cols-2 gap-4 rounded-md border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4 lg:grid-cols-6">
        <Stat
          label="p-value"
          value={atFloor ? `≤ ${fmt(result.pvalue)}` : fmt(result.pvalue)}
          hint={
            atFloor
              ? `Resolution floor of ${result.n_permutations} permutations: the true value is at or below this.`
              : undefined
          }
        />
        <Stat
          label="Mean percentile"
          value={`${(result.mean_percentile * 100).toFixed(1)}%`}
          hint="0% is the top of the ranking, so lower is better."
        />
        <Stat label="Genes ranked" value={`${result.n_hits} / ${genesSentTotal}`} />
        <Stat
          label="Confidence"
          value={result.confidence === 'low' ? 'Low' : 'Normal'}
          hint={
            result.confidence === 'low'
              ? 'Underpowered signature: read every conclusion as exploratory.'
              : undefined
          }
        />
        <Stat
          label="Null draw"
          value={result.matched_expression ? 'Expression-matched' : 'Unmatched'}
          hint="Matched on tumour expression deciles: a gene that is highly expressed is more likely both to be called differential and to rank well."
        />
        <Stat
          label="Permutations"
          value={`${result.n_permutations} (seed ${result.seed})`}
          hint="Same seed, same p-value."
        />
      </dl>

      {result.confidence === 'low' && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          This signature is underpowered (two replicates in at least one condition). Every
          conclusion below is weakened and should be read as exploratory.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-2">Direction</th>
              <th className="p-2">
                <button type="button" onClick={() => setSortBy('rank')}>Rank</button>
              </th>
              <th className="p-2">Gene</th>
              <th className="p-2">
                <button type="button" onClick={() => setSortBy('percentile')}>Percentile</button>
              </th>
              <th className="p-2">Composite</th>
              <th className="p-2">Coverage</th>
              <th className="p-2">Axes</th>
              {axes.map((axis) => (
                <th key={axis} className="p-2">
                  {axis}
                  {weights[axis] !== undefined && (
                    <span className="ml-1 font-normal normal-case text-gray-400">
                      ({fmt(weights[axis], 2)})
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((target) => {
              const direction = directionBySymbol[target.symbol];
              return (
                <tr key={target.gene_id}>
                  <td className="p-2">
                    {direction ? (
                      <span
                        className={
                          direction === 'UP'
                            ? 'text-xs font-medium text-red-600'
                            : 'text-xs font-medium text-blue-600'
                        }
                      >
                        {direction}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="p-2 text-gray-500">{target.rank}</td>
                  <td className="p-2 font-medium text-gray-900">
                    {target.symbol}
                    <span className="ml-2 text-xs text-gray-400">{target.gene_id}</span>
                  </td>
                  <td className="p-2">{(target.percentile * 100).toFixed(1)}%</td>
                  <td className="p-2">{fmt(target.composite)}</td>
                  <td className="p-2">{fmt(target.coverage, 2)}</td>
                  <td className="p-2">{target.n_axes_scored}</td>
                  {axes.map((axis) => {
                    const value = target.subscores[axis];
                    return (
                      <td key={axis} className="p-2">
                        {value === null || value === undefined ? (
                          <span
                            className="text-gray-300"
                            title="Axis not measured for this gene"
                          >
                            —
                          </span>
                        ) : (
                          fmt(value, 2)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
