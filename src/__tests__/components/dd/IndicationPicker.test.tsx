import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import IndicationPicker from '@/components/tools/dd/IndicationPicker';

const INDICATIONS = [
  { tcga_project: 'TCGA-BRCA', disease_name: 'breast carcinoma', excluded: false, rationale: null },
  {
    tcga_project: 'TCGA-PCPG',
    disease_name: 'pheochromocytoma',
    excluded: true,
    rationale: "EXCLU le 2026-07-29 : l'identifiant de maladie est ambigu.",
  },
];

describe('IndicationPicker', () => {
  it('sélectionne une indication couverte', async () => {
    const onSelect = jest.fn();
    render(
      <IndicationPicker
        indications={INDICATIONS}
        value={null}
        onSelect={onSelect}
        onForceExcluded={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /breast carcinoma/i }));
    expect(onSelect).toHaveBeenCalledWith('TCGA-BRCA');
  });

  it('affiche le motif et refuse la sélection directe d\'une exclue', async () => {
    const onSelect = jest.fn();
    const onForce = jest.fn();
    render(
      <IndicationPicker
        indications={INDICATIONS}
        value={null}
        onSelect={onSelect}
        onForceExcluded={onForce}
      />,
    );
    const excluded = screen.getByRole('button', { name: /pheochromocytoma/i });
    expect(excluded).toBeDisabled();
    // Le motif est lisible AVANT le clic, pas seulement dans le 422.
    expect(screen.getByText(/identifiant de maladie est ambigu/i)).toBeInTheDocument();
    await userEvent.click(excluded);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onForce).not.toHaveBeenCalled();
  });

  it('force un run exclu seulement après confirmation', async () => {
    const onForce = jest.fn();
    render(
      <IndicationPicker
        indications={INDICATIONS}
        value={null}
        onSelect={jest.fn()}
        onForceExcluded={onForce}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /lancer sans axe maladie.*TCGA-PCPG/i }),
    );
    expect(onForce).not.toHaveBeenCalled();
    // La confirmation répète le motif : c'est ce qu'on demande d'assumer.
    expect(screen.getByRole('dialog')).toHaveTextContent(/identifiant de maladie est ambigu/i);
    await userEvent.click(screen.getByRole('button', { name: /je comprends/i }));
    expect(onForce).toHaveBeenCalledWith('TCGA-PCPG');
  });
});
