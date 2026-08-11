import { render, screen } from '@testing-library/react';

import { ReportFigures } from '@/components/tools/dd/ReportFigures';
import type { DdFigure } from '@/types/drugDiscovery';

const topTargets: DdFigure = {
  kind: 'top_targets',
  version: '1.0.0',
  caption: 'Composite score of the top 2 targets.',
  evidence_ids: ['ev-1', 'ev-2'],
  bars: [
    { gene_id: 'ENSG1', symbol: 'ERBB2', composite: 0.62, evidence_ids: ['ev-1'] },
    { gene_id: 'ENSG2', symbol: 'EGFR', composite: 0.41, evidence_ids: ['ev-2'] },
  ],
};

it("rend les barres dans l'ordre du classement", () => {
  render(<ReportFigures figures={[topTargets]} />);
  const labels = screen.getAllByTestId('dd-bar-label').map((n) => n.textContent);
  expect(labels).toEqual(['ERBB2', 'EGFR']);
});

it('affiche la légende de la figure', () => {
  render(<ReportFigures figures={[topTargets]} />);
  expect(screen.getByText(/Composite score of the top 2 targets/)).toBeInTheDocument();
});

it("prévient quand le type de figure lui est inconnu, plutôt que de ne rien montrer", () => {
  // Un client qui ne voit pas une figure doit savoir qu'il en manque une : un blanc se lit
  // comme « il n'y avait rien à montrer ».
  const futureFigure = {
    kind: 'null_distribution', version: '1.0.0', caption: 'Null draw',
    evidence_ids: ['ev-9'],
  } as unknown as DdFigure;
  render(<ReportFigures figures={[futureFigure]} />);
  expect(screen.getByText(/Null draw/)).toBeInTheDocument();
  expect(screen.getByText(/not rendered by this version/i)).toBeInTheDocument();
});

it("n'affiche rien pour une figure sans barre", () => {
  const empty: DdFigure = { ...topTargets, bars: [] };
  const { container } = render(<ReportFigures figures={[empty]} />);
  expect(container).toBeEmptyDOMElement();
});

it("n'affiche rien quand il n'y a aucune figure", () => {
  const { container } = render(<ReportFigures figures={[]} />);
  expect(container).toBeEmptyDOMElement();
});
