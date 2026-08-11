import { render, screen } from '@testing-library/react';

import { BarTooltip, ReportFigures } from '@/components/tools/dd/ReportFigures';
import type { DdFigure, DdTopTargetsFigure } from '@/types/drugDiscovery';

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

const topTargets: DdTopTargetsFigure = {
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
  // comme « il n'y avait rien à montrer ». `DdFigure` est la forme du fil (`kind: string`) :
  // ce constructeur n'a besoin d'AUCUN cast, contrairement à l'ancien alias à un seul
  // membre — c'est précisément ce que le constat I3 demandait de rendre possible.
  const futureFigure: DdFigure = {
    kind: 'null_distribution', version: '1.0.0', caption: 'Null draw',
    evidence_ids: ['ev-9'],
  };
  render(<ReportFigures figures={[futureFigure]} />);
  expect(screen.getByText(/Null draw/)).toBeInTheDocument();
  expect(screen.getByText(/not rendered by this version/i)).toBeInTheDocument();
});

it("prévient aussi quand la majeure d'un type connu n'est pas supportée", () => {
  // Un `top_targets` v2 doit tomber sur le même avis qu'une figure future, jamais être
  // remis à un renderer v1 qui le dessinerait faux plutôt qu'absent (constat I2).
  const futureMajor: DdTopTargetsFigure = { ...topTargets, version: '2.0.0' };
  render(<ReportFigures figures={[futureMajor]} />);
  expect(screen.getByText(/not rendered by this version/i)).toBeInTheDocument();
});

it("n'affiche rien pour une figure sans barre", () => {
  const empty: DdTopTargetsFigure = { ...topTargets, bars: [] };
  const { container } = render(<ReportFigures figures={[empty]} />);
  expect(container).toBeEmptyDOMElement();
});

it("n'affiche rien quand il n'y a aucune figure", () => {
  const { container } = render(<ReportFigures figures={[]} />);
  expect(container).toBeEmptyDOMElement();
});

// ---------------------------------------------------------------------------------------
// Géométrie de marque — promue de la dette au bloquant : cet invariant a déjà régressé en
// silence pendant ce lot (une hauteur d'axe X implicite non budgétée), rattrapé seulement
// par une inspection manuelle du SVG. Un invariant qui a régressé une fois régressera.
// ---------------------------------------------------------------------------------------

it('dessine des barres de 24 px avec un écart de 2 px entre barres adjacentes', () => {
  const { container } = render(<ReportFigures figures={[topTargets]} />);
  const bars = Array.from(container.querySelectorAll<SVGPathElement>('.recharts-rectangle'));
  expect(bars).toHaveLength(2);

  for (const bar of bars) {
    expect(bar.getAttribute('height')).toBe('24');
  }

  const tops = bars.map((bar) => Number(bar.getAttribute('y')));
  // 24 px de barre + 2 px d'écart : deux barres adjacentes commencent à 26 px d'écart.
  expect(tops[1] - tops[0]).toBe(26);
});

it('arrondit l\'extrémité côté donnée et garde un angle carré à la ligne de base', () => {
  const { container } = render(<ReportFigures figures={[topTargets]} />);
  const bars = Array.from(container.querySelectorAll<SVGPathElement>('.recharts-rectangle'));
  expect(bars.length).toBeGreaterThan(0);

  for (const bar of bars) {
    const path = (bar.getAttribute('d') ?? '').replace(/\s+/g, ' ').trim();
    // Extrémité côté donnée (l'autre bout que la ligne de base) : deux coins arrondis, de
    // rayon 4 — cf. `radius={[0, 4, 4, 0]}` sur `<Bar>`.
    expect(path.match(/A ?4,4,0,0,1/g)).toHaveLength(2);
    // Ligne de base (x = 0 du domaine) : le tracé part et se referme par une ligne droite,
    // jamais un arc — les deux coins de ce côté sont carrés.
    expect(/^M[\d.,-]+L/.test(path)).toBe(true);
    expect(/L[\d.,\s-]+Z$/.test(path)).toBe(true);
  }
});

// ---------------------------------------------------------------------------------------
// BarTooltip — le dernier mètre de la chaîne qui justifie l'existence des evidences par
// barre. Rendu directement avec un faux `payload` plutôt qu'en simulant le survol de
// recharts, dont l'API d'événements de souris n'est pas ce qui est sous test ici.
// ---------------------------------------------------------------------------------------

describe('BarTooltip', () => {
  const row = {
    gene_id: 'ENSG1', symbol: 'ERBB2', composite: 0.62, evidence_ids: ['ev-1', 'ev-2'],
  };

  it("affiche le symbole, le composite et les evidences de la barre survolée", () => {
    render(
      <BarTooltip
        active
        payload={[{ payload: row, graphicalItemId: 'bar-0' }]}
      />
    );
    expect(screen.getByText('ERBB2')).toBeInTheDocument();
    expect(screen.getByText('Composite: 0.62')).toBeInTheDocument();
    expect(screen.getByText(/ev-1, ev-2/)).toBeInTheDocument();
  });

  it("ne rend rien quand elle n'est pas active", () => {
    const { container } = render(
      <BarTooltip active={false} payload={[{ payload: row, graphicalItemId: 'bar-0' }]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien sans payload", () => {
    const { container } = render(<BarTooltip active payload={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
