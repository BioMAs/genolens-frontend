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
      <div className="mb-4 flex flex-wrap items-center gap-4 text-body-sm text-secondary">
        <span className="font-medium text-primary">{data.n_ranked} targets ranked</span>
        <span>{data.n_excluded_insufficient_evidence} excluded for insufficient evidence</span>
        <span>{data.n_disqualified_common_essential} disqualified (common essential)</span>
        <span>{data.n_disqualified_safety_floor} below the safety floor</span>
        <span>{data.n_excluded_missing_required_axis} missing required axis</span>
        <label className="ml-auto">
          Show{' '}
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="rounded-sm border border-strong p-1"
          >
            {LIMITS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead className="bg-surface-2 text-left text-caption uppercase text-secondary">
            <tr>
              <th>
                <button type="button" onClick={() => setSortBy('rank')}>Rank</button>
              </th>
              <th>Gene</th>
              <th>Composite</th>
              <th>Percentile</th>
              <th>
                <button type="button" onClick={() => setSortBy('coverage')}>Coverage</button>
              </th>
              <th>Axes</th>
              {axes.map((axis) => (
                <th key={axis} className="p-2">
                  {axis}
                  {weights[axis] !== undefined && (
                    <span className="ml-1 font-normal normal-case text-muted">
                      ({fmt(weights[axis], 2)})
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {rows.map((target) => (
              <tr key={target.gene_id}>
                <td className="text-secondary">{target.rank}</td>
                <td className="font-medium">
                  {target.symbol}
                  <span className="ml-2 text-caption text-muted">{target.gene_id}</span>
                </td>
                <td>{fmt(target.composite)}</td>
                <td>{fmt(target.percentile)}</td>
                <td>{fmt(target.coverage, 2)}</td>
                <td>{target.n_axes_scored}</td>
                {axes.map((axis) => {
                  const value = target.subscores[axis];
                  return (
                    <td key={axis} className="p-2">
                      {value === null || value === undefined ? (
                        <span className="text-gray-300" title="Axis not measured for this gene">
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
