import { render, screen } from '@testing-library/react';
import React from 'react';

import ReportView from '@/components/tools/dd/ReportView';

// Formats réels produits par genolens-dd (src/genolens_dd/report/ir.py) :
// - `bibliography()` est dédupliquée par SOURCE, une entrée `"{source} {release} — {licence}"`.
//   Plusieurs evidence_ids peuvent partager la même entrée : elle n'est pas adressable par id.
// - `appendix()` porte une ligne par evidence_id cité, au format `"[id] kind — subject (...)"`.
const REPORT = {
  run_id: 'r1',
  indication: 'TCGA-BRCA',
  profile: 'default_oncology',
  weights_hash: 'abc123',
  source_releases: { gtex: 'v8' },
  attributions: ['GTEx v8 — dbGaP phs000424'],
  n_targets_without_evidence: 2,
  sections: [
    {
      title: 'Cibles principales',
      claims: [
        {
          text: 'ERBB2 est surexprimé dans la tumeur.',
          template: 'disease_overexpression',
          template_version: '1.0',
          evidence_ids: ['ev-1'],
        },
        {
          text: 'TP53 montre un signal de dépendance isolé.',
          template: 'dependency_selective',
          template_version: '1.0',
          evidence_ids: ['ev-2'],
        },
      ],
    },
  ],
  // ev-2 est cité par une claim mais n'a volontairement aucune entrée d'annexe correspondante :
  // c'est le cas du renvoi qui ne doit jamais être émis.
  bibliography: ['depmap 24Q4 — CC-BY-4.0'],
  appendix: ['[ev-1] disease_observation — ERBB2 (xena TCGA-BRCA)'],
};

describe('ReportView', () => {
  it("rend chaque claim avec un renvoi qui résout réellement vers son entrée d'annexe", () => {
    render(<ReportView report={REPORT} />);
    expect(screen.getByText(/ERBB2 est surexprimé/)).toBeInTheDocument();

    const citation = screen.getByRole('link', { name: 'ev-1' });
    const href = citation.getAttribute('href');
    expect(href).toBe('#ref-ev-1');

    const target = document.getElementById(href!.slice(1));
    expect(target).not.toBeNull();
    expect(target).toHaveTextContent('[ev-1] disease_observation — ERBB2 (xena TCGA-BRCA)');
  });

  it("n'émet aucun renvoi pour un evidence_id absent de l'annexe", () => {
    render(<ReportView report={REPORT} />);
    expect(screen.getByText(/TP53 montre un signal/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'ev-2' })).toBeNull();
    expect(screen.queryByText('ev-2')).toBeNull();
  });

  it('signale les cibles écartées faute de preuve', () => {
    render(<ReportView report={REPORT} />);
    // Sans ça, l'utilisateur croit lire le top 10 du classement.
    expect(screen.getByText(/2 cibles/i)).toBeInTheDocument();
  });

  it("affiche l'annexe des preuves en permanence, sans repli derrière un bouton", () => {
    render(<ReportView report={REPORT} />);
    expect(screen.getByText('Preuves')).toBeInTheDocument();
    expect(screen.getByText(/\[ev-1\] disease_observation/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('affiche la bibliographie comme une liste de sources non cliquable', () => {
    render(<ReportView report={REPORT} />);
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText(/depmap 24Q4 — CC-BY-4.0/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /depmap/i })).toBeNull();
  });

  it('affiche les attributions', () => {
    render(<ReportView report={REPORT} />);
    expect(screen.getByText(/dbGaP phs000424/)).toBeInTheDocument();
  });
});
