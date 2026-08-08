import { render, screen } from '@testing-library/react';
import React from 'react';

import SignatureHitsTable from '@/components/tools/dd/SignatureHitsTable';
import { DdSignatureResult, DdTarget } from '@/types/drugDiscovery';

/**
 * Le bandeau du mode B affiche trois chiffres qui, seuls, se lisent à l'envers ou pas du tout.
 * Ces tests portent sur ça, pas sur le rendu du tableau.
 */

function target(overrides: Partial<DdTarget> = {}): DdTarget {
  return {
    gene_id: 'ENSG1',
    symbol: 'ERBB2',
    composite: 0.8,
    rank: 3,
    percentile: 0.02,
    coverage: 1,
    n_axes_scored: 5,
    subscores: { safety: 0.5, dependency: null },
    ...overrides,
  };
}

function result(overrides: Partial<DdSignatureResult> = {}): DdSignatureResult {
  return {
    hits: [target()],
    outside_universe: [],
    n_hits: 1,
    n_outside_universe: 0,
    mean_percentile: 0.02,
    pvalue: 0.004,
    confidence: 'normal',
    seed: 1234,
    n_permutations: 1000,
    matched_expression: true,
    disclosures: [],
    unresolved: [],
    corrected: [],
    n_input: 1,
    n_resolved: 1,
    signature_id: 's1',
    ...overrides,
  };
}

function renderTable(overrides: Partial<DdSignatureResult> = {}, direction = {}) {
  return render(
    <SignatureHitsTable
      result={result(overrides)}
      weights={{ safety: 0.3 }}
      directionBySymbol={direction}
      genesSentTotal={10}
    />,
  );
}

describe('SignatureHitsTable', () => {
  it("dit dans quel sens lire le percentile, parce que 0 % est le MEILLEUR rang", () => {
    // `percentile = position / n_ranked` depuis la tête : « 2 % » se lirait spontanément comme
    // un mauvais résultat alors que c'est le sommet du classement.
    renderTable();
    // Deux occurrences attendues : le percentile moyen du bandeau et celui de la ligne.
    expect(screen.getAllByText('2.0%')).toHaveLength(2);
    expect(
      screen.getByTitle('0% is the top of the ranking, so lower is better.'),
    ).toBeInTheDocument();
  });

  it("signale le plancher de résolution au lieu d'afficher la borne comme une mesure", () => {
    // `(1+k)/(1+n)` ne peut pas descendre sous 1/1001. Afficher « 0.001 » nu ferait lire une
    // mesure là où il y a une limite d'échantillonnage — même faute que « p = 0 ».
    renderTable({ pvalue: 1 / 1001 });
    expect(screen.getByText(/^≤ 0\.001$/)).toBeInTheDocument();
  });

  it("affiche la p-value telle quelle quand elle n'est pas au plancher", () => {
    renderTable({ pvalue: 0.004 });
    expect(screen.getByText('0.004')).toBeInTheDocument();
    expect(screen.queryByText(/^≤/)).not.toBeInTheDocument();
  });

  it("n'affiche AUCUN chiffre quand l'intersection est vide", () => {
    // Un « p = — » posé à côté d'un percentile se lit comme un résultat non significatif,
    // alors qu'aucun test n'a eu lieu.
    renderTable({
      hits: [],
      n_hits: 0,
      pvalue: null,
      mean_percentile: null,
      outside_universe: ['BRAF'],
      n_outside_universe: 1,
      n_resolved: 1,
    });
    expect(
      screen.getByText(/None of your genes is in the ranked universe/),
    ).toBeInTheDocument();
    expect(screen.queryByText('p-value')).not.toBeInTheDocument();
  });

  it('rend le badge de confiance basse collant sur les résultats', () => {
    renderTable({ confidence: 'low' });
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText(/read as exploratory/)).toBeInTheDocument();
  });

  it('joint la direction depuis les listes réellement envoyées', () => {
    renderTable({}, { ERBB2: 'UP' as const });
    expect(screen.getByText('UP')).toBeInTheDocument();
  });

  it("laisse la direction vide plutôt que d'en inventer une", () => {
    const { container } = renderTable({}, {});
    // Un tiret, pas une direction devinée : la direction d'un hit ne se déduit d'aucune autre
    // donnée disponible côté client.
    expect(container.querySelectorAll('td')[0].textContent).toBe('—');
  });

  it("rend un axe non mesuré comme absent, jamais comme un zéro", () => {
    renderTable();
    expect(
      screen.getByTitle('Axis not measured for this gene'),
    ).toBeInTheDocument();
  });
});
