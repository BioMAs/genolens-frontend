import { render, screen } from '@testing-library/react';
import React from 'react';

import TargetTable from '@/components/tools/dd/TargetTable';

const DATA = {
  run_id: 'r1',
  n_ranked: 2,
  n_excluded_insufficient_evidence: 120,
  n_disqualified_common_essential: 8,
  n_disqualified_safety_floor: 3,
  n_excluded_missing_required_axis: 45,
  missing_required_by_axis: { dependency: 45 },
  targets: [
    {
      gene_id: 'ENSG00000141736',
      symbol: 'ERBB2',
      composite: 0.812345,
      rank: 1,
      percentile: 0.999,
      coverage: 0.6,
      n_axes_scored: 3,
      subscores: { disease: 0.9, dependency: null, safety: 0.11 },
    },
  ],
};

describe('TargetTable', () => {
  it('affiche toujours la couverture à côté du composite', () => {
    render(
      <TargetTable data={DATA} weights={{ disease: 0.4 }} limit={50} onLimitChange={jest.fn()} />,
    );
    // Un composite sans sa couverture est trompeur : 0,9 sur 2 axes et 0,9 sur 6 axes ne
    // veulent pas dire la même chose.
    expect(screen.getByText('ERBB2')).toBeInTheDocument();
    expect(screen.getByText(/0[.,]60/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('rend les compteurs d\'exclusion séparément', () => {
    render(
      <TargetTable data={DATA} weights={{}} limit={50} onLimitChange={jest.fn()} />,
    );
    // « écarté faute de preuve » et « disqualifié essentiel commun » ne se défendent pas
    // pareil devant un client : dd les compte séparément, l'UI ne doit pas les additionner.
    expect(screen.getByText(/120/)).toBeInTheDocument();
    expect(screen.getByText(/\b8\b/)).toBeInTheDocument();
    expect(screen.getByText(/45/)).toBeInTheDocument();
  });

  it('marque un sous-score non mesuré autrement qu\'un zéro', () => {
    render(
      <TargetTable data={DATA} weights={{ dependency: 0.2 }} limit={50} onLimitChange={jest.fn()} />,
    );
    expect(screen.getByTitle(/non mesuré/i)).toBeInTheDocument();
  });
});
