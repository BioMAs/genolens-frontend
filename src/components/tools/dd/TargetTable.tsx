'use client';

/**
 * Le classement.
 *
 * `coverage` et `n_axes_scored` sont des colonnes de plein droit, jamais un dépliage : un
 * composite de 0,9 sur deux axes et un composite de 0,9 sur six axes ne veulent pas dire la
 * même chose, et rien dans le nombre ne le dit.
 *
 * Les quatre compteurs d'exclusion sont rendus séparément, comme dd les compte. « Écarté faute
 * de preuve » signale un manque de données ; « disqualifié essentiel commun » est une décision
 * qui se défend devant un client. Les additionner rendrait le tableau muet sur la seule
 * question que l'utilisateur pose : pourquoi mon gène n'est-il pas là ?
 */
import { useMemo, useState } from 'react';

import { DdTarget, DdTargetsResponse } from '@/types/drugDiscovery';

interface TargetTableProps {
  data: DdTargetsResponse;
  weights: Record<string, number>;
  limit: number;
  onLimitChange: (limit: number) => void;
}

const LIMITS = [25, 50, 100, 250, 1000];

function fmt(value: number, digits = 3): string {
  return value.toFixed(digits);
}

export default function TargetTable({ data, weights, limit, onLimitChange }: TargetTableProps) {
  const [sortBy, setSortBy] = useState<'rank' | 'coverage'>('rank');

  const axes = useMemo(() => {
    const names = new Set<string>();
    data.targets.forEach((t) => Object.keys(t.subscores).forEach((a) => names.add(a)));
    return Array.from(names).sort();
  }, [data.targets]);

  const rows: DdTarget[] = useMemo(() => {
    const copy = [...data.targets];
    copy.sort((a, b) => (sortBy === 'rank' ? a.rank - b.rank : b.coverage - a.coverage));
    return copy;
  }, [data.targets, sortBy]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="font-medium text-gray-900">{data.n_ranked} cibles classées</span>
        <span>{data.n_excluded_insufficient_evidence} écartées faute de preuve suffisante</span>
        <span>{data.n_disqualified_common_essential} disqualifiées (essentiel commun)</span>
        <span>{data.n_disqualified_safety_floor} sous le plancher de sécurité</span>
        <span>{data.n_excluded_missing_required_axis} sans axe obligatoire</span>
        <label className="ml-auto">
          Afficher{' '}
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="rounded border border-gray-300 p-1"
          >
            {LIMITS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="p-2">
                <button type="button" onClick={() => setSortBy('rank')}>Rang</button>
              </th>
              <th className="p-2">Gène</th>
              <th className="p-2">Composite</th>
              <th className="p-2">Percentile</th>
              <th className="p-2">
                <button type="button" onClick={() => setSortBy('coverage')}>Couverture</button>
              </th>
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
            {rows.map((target) => (
              <tr key={target.gene_id}>
                <td className="p-2 text-gray-500">{target.rank}</td>
                <td className="p-2 font-medium text-gray-900">
                  {target.symbol}
                  <span className="ml-2 text-xs text-gray-400">{target.gene_id}</span>
                </td>
                <td className="p-2">{fmt(target.composite)}</td>
                <td className="p-2">{fmt(target.percentile)}</td>
                <td className="p-2">{fmt(target.coverage, 2)}</td>
                <td className="p-2">{target.n_axes_scored}</td>
                {axes.map((axis) => {
                  const value = target.subscores[axis];
                  return (
                    <td key={axis} className="p-2">
                      {value === null || value === undefined ? (
                        <span className="text-gray-300" title="Axe non mesuré pour ce gène">
                          —
                        </span>
                      ) : (
                        fmt(value, 2)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
