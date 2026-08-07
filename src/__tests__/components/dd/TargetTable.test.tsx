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
    // Chaque assertion lie la valeur à SON libellé (pas juste « ce nombre existe quelque
    // part ») : les quatre valeurs de la fixture sont distinctes (120, 8, 3, 45), donc un
    // échange de libellés entre deux compteurs ferait échouer le test correspondant.
    expect(
      screen.getByText(/120\s*excluded for insufficient evidence/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/8\s*disqualified \(common essential\)/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/3\s*below the safety floor/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/45\s*missing required axis/),
    ).toBeInTheDocument();
  });

  it('marque un sous-score non mesuré autrement qu\'un zéro mesuré', () => {
    // La fixture porte ici, sur la même cible, un axe non mesuré (dependency: null) ET un
    // axe mesuré à zéro (tractability: 0). Un test qui ne contiendrait aucun vrai zéro ne
    // pourrait pas distinguer `value === null` d'un test de falsy (`!value`) : les deux
    // afficheraient « non mesuré » pour du `null`. Seule la présence d'un zéro mesuré, rendu
    // comme valeur numérique et jamais comme « non mesuré », prouve la distinction.
    const dataWithMeasuredZero = {
      ...DATA,
      targets: [
        {
          ...DATA.targets[0],
          subscores: { disease: 0.9, dependency: null, safety: 0.11, tractability: 0 },
        },
      ],
    };
    render(
      <TargetTable
        data={dataWithMeasuredZero}
        weights={{ dependency: 0.2 }}
        limit={50}
        onLimitChange={jest.fn()}
      />,
    );

    // Le zéro mesuré s'affiche comme une valeur numérique, sans marqueur "non mesuré".
    const measuredZero = screen.getByText('0.00');
    expect(measuredZero).toBeInTheDocument();
    expect(measuredZero).not.toHaveAttribute('title');

    // L'axe non mesuré (null), lui, porte le marqueur — et ce n'est pas le même nœud.
    const unmeasured = screen.getByTitle(/not measured/i);
    expect(unmeasured).toBeInTheDocument();
    expect(unmeasured).not.toHaveTextContent('0.00');
  });
});
