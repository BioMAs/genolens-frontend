import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import SignatureDisclosures from '@/components/tools/dd/SignatureDisclosures';
import {
  SIGNATURE_RULES,
  parseSignatureRejection,
} from '@/components/tools/dd/signatureRules';
import { DdSignatureResult } from '@/types/drugDiscovery';

function result(overrides: Partial<DdSignatureResult> = {}): DdSignatureResult {
  return {
    hits: [],
    outside_universe: [],
    n_hits: 0,
    n_outside_universe: 0,
    mean_percentile: null,
    pvalue: null,
    confidence: 'normal',
    seed: 1,
    n_permutations: 1000,
    matched_expression: true,
    disclosures: [],
    unresolved: [],
    corrected: [],
    n_input: 0,
    n_resolved: 0,
    signature_id: 's1',
    ...overrides,
  };
}

describe('SignatureDisclosures', () => {
  it('NOMME les gènes non résolus au lieu de les compter', () => {
    // « Écarter silencieusement 300 des 2 000 DEG d'un client et livrer un rapport sur le
    // reste » est l'erreur que le module amont existe pour interdire. Un compteur seul est
    // la version polie de cette erreur.
    render(<SignatureDisclosures result={result({ unresolved: ['ZZZ1', 'ZZZ2'] })} />);
    fireEvent.click(screen.getByText('Show the genes'));
    expect(screen.getByText('ZZZ1, ZZZ2')).toBeInTheDocument();
  });

  it('garde les trois listes distinctes, parce qu’elles appellent trois actions', () => {
    render(
      <SignatureDisclosures
        result={result({
          unresolved: ['ZZZ1'],
          corrected: ['1-Mar'],
          outside_universe: ['BRAF'],
          n_outside_universe: 1,
        })}
      />,
    );
    expect(screen.getByText('Not resolved (1)')).toBeInTheDocument();
    expect(screen.getByText('Repaired symbols (1)')).toBeInTheDocument();
    expect(screen.getByText('Resolved but not ranked (1)')).toBeInTheDocument();
  });

  it("dit qu'un gène hors univers est un résultat et non une erreur", () => {
    // Fondu dans « non résolu », il ferait chercher un problème de fichier là où il n'y en a pas.
    render(
      <SignatureDisclosures result={result({ outside_universe: ['BRAF'], n_outside_universe: 1 })} />,
    );
    expect(screen.getByText(/This is a result, not an error/)).toBeInTheDocument();
  });

  it('rend les divulgations amont verbatim', () => {
    render(
      <SignatureDisclosures
        result={result({ disclosures: ['Signature sous-dimensionnée : exploratoire.'] })} />,
    );
    expect(
      screen.getByText('Signature sous-dimensionnée : exploratoire.'),
    ).toBeInTheDocument();
  });

  it("ne rend rien quand il n'y a rien à divulguer", () => {
    const { container } = render(<SignatureDisclosures result={result()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('parseSignatureRejection', () => {
  it('lit le détail structuré renvoyé par le service', () => {
    const rejection = parseSignatureRejection({
      response: { data: { detail: { rule_id: 'SIG002', conditions: ['traite'] } } },
    });
    expect(rejection?.rule_id).toBe('SIG002');
    expect(rejection?.conditions).toEqual(['traite']);
  });

  it("retombe sur l'identifiant dans une chaîne si le détail est aplati", () => {
    // Sans ce repli, une réponse aplatie par un intermédiaire ne s'afficherait pas du tout.
    const rejection = parseSignatureRejection({
      response: { data: { detail: 'SIG004 — La condition ne contient aucun gène.' } },
    });
    expect(rejection?.rule_id).toBe('SIG004');
  });

  it("rend null sur une erreur qui n'est pas un rejet de règle", () => {
    expect(parseSignatureRejection({ response: { data: { detail: 'Dataset not found' } } })).toBeNull();
    expect(parseSignatureRejection(new Error('network'))).toBeNull();
  });

  it("n'ouvre une échappatoire que pour SIG002", () => {
    // SIG001 (un seul réplicat) est inappelable par conception : offrir une case à cocher
    // laisserait croire le contraire, et l'utilisateur relancerait en boucle.
    expect(SIGNATURE_RULES.SIG002.appealable).toBe(true);
    expect(SIGNATURE_RULES.SIG001.appealable).toBe(false);
    expect(
      Object.entries(SIGNATURE_RULES).filter(([, copy]) => copy.appealable).map(([id]) => id),
    ).toEqual(['SIG002']);
  });

  it('a un texte anglais pour chaque règle amont', () => {
    // Les textes de genolens-dd sont en français et l'interface est en anglais : rendre le
    // message amont verbatim régresserait la localisation du module.
    ['SIG001', 'SIG002', 'SIG003', 'SIG004', 'SIG005', 'SIG006'].forEach((id) => {
      expect(SIGNATURE_RULES[id].title).toBeTruthy();
      expect(SIGNATURE_RULES[id].explanation).toBeTruthy();
    });
  });
});
