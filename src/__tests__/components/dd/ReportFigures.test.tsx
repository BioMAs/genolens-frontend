import { render, screen } from '@testing-library/react';

import { ReportFigures } from '@/components/tools/dd/ReportFigures';
import type { DdFigure } from '@/types/drugDiscovery';

// Le composant utilise `<ResponsiveContainer>` (recharts) pour que seule la largeur soit
// fluide — cf. le commentaire d'en-tête de ReportFigures.tsx. `ResponsiveContainer` mesure le
// conteneur via `ResizeObserver` + `getBoundingClientRect()`, ni l'un ni l'autre disponibles
// (avec une vraie mesure) dans jsdom : sans ce double stub, le graphique ne se rend jamais en
// test — pas une lacune du composant, une lacune de l'environnement de test. Scopé à ce fichier
// plutôt que jest.setup.tsx pour ne pas affecter les autres suites.
class StubResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
  global.ResizeObserver = StubResizeObserver;
  // Seul le conteneur mesuré par `ResponsiveContainer` a besoin d'une taille non nulle : le
  // reste (notamment le span de mesure de texte interne à recharts, utilisé pour décider si
  // deux étiquettes de l'axe Y se chevaucheraient) doit garder le comportement par défaut de
  // jsdom (une rect nulle), sous peine de faire croire à recharts que chaque étiquette mesure
  // 400x300 px et de les masquer toutes pour éviter un chevauchement qui n'existe pas.
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element
  ) {
    if (this.classList.contains('recharts-responsive-container')) {
      return {
        width: 400,
        height: 300,
        top: 0,
        left: 0,
        right: 400,
        bottom: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalGetBoundingClientRect.call(this);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

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
