import { buildPlotlyLayout, mergePlotlyLayout } from '@/utils/plotlyLayout';
import type { ChartTheme } from '@/utils/chartTheme';

/**
 * La fabrique de mise en page Plotly.
 *
 * Testée en fonction pure, et pas au rendu : Plotly dessine en canvas/WebGL, et
 * jsdom n'a ni l'un ni l'autre. C'est exactement le raisonnement déjà écrit
 * dans le test de `cytoscapeAdapters`, et c'est pourquoi toute décision de
 * couleur est poussée dans une fonction qui prend un thème explicite. Une
 * faute de token est invisible sur un canvas ; elle est bruyante dans un diff.
 */
const THEME: ChartTheme = {
  ink: '#INK', inkMuted: '#MUTED', inkSubtle: '#SUBTLE',
  grid: '#GRID', axis: '#AXIS',
  surface: '#SURF', surfaceRaised: '#RAISED', hover: '#HOVER',
  accent: '#ACCENT', accentSoft: '#ACCENTSOFT',
  up: '#UP', down: '#DOWN', ns: '#NS', zero: '#ZERO',
  fontFamily: 'TestFont',
};

describe('buildPlotlyLayout', () => {
  it('impose la police du produit', () => {
    // Aucun des huit composants ne fixait `font.family` : Plotly dessinait donc
    // en Open Sans, une police absente du reste de l'application.
    const l = buildPlotlyLayout(THEME);
    expect((l.font as Record<string, unknown>).family).toBe('TestFont');
  });

  it('rend le fond transparent plutôt que blanc', () => {
    const l = buildPlotlyLayout(THEME);
    expect(l.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(l.plot_bgcolor).toBe('rgba(0,0,0,0)');
  });

  it('déclare une palette catégorielle et un survol thémés', () => {
    const l = buildPlotlyLayout(THEME);
    expect(Array.isArray(l.colorway)).toBe(true);
    expect((l.hoverlabel as Record<string, unknown>).bgcolor).toBe('#RAISED');
  });

  it("fusionne un axe en profondeur plutôt que de l'écraser", () => {
    // Un simple étalement perdrait gridcolor et tickfont — la classe de défaut
    // que cette fabrique existe pour supprimer.
    const l = buildPlotlyLayout(THEME, { xaxis: { title: { text: 'log2FC' } } });
    const x = l.xaxis as Record<string, unknown>;
    expect(x.title).toEqual({ text: 'log2FC' });
    expect(x.gridcolor).toBe('#GRID');
    expect(x.automargin).toBe(true);
  });
});

describe('mergePlotlyLayout — mise en page arbitraire', () => {
  /**
   * L'implémentation actuelle de chat/PlotlyFigure fait `{...défauts, ...layout}` :
   * la spec entrante écrase TOUT. Sans conséquence tant qu'il n'y a pas de
   * défauts de thème ; fatale dès que cette fabrique est branchée.
   */
  const HOSTILE = {
    paper_bgcolor: 'white',
    plot_bgcolor: '#ffffff',
    font: { family: 'Comic Sans MS', color: '#000000' },
    colorway: ['#ff0000'],
    hoverlabel: { bgcolor: 'white' },
    xaxis: { gridcolor: '#000000', title: { text: 'garde-moi' } },
    title: { text: 'garde-moi aussi' },
    barmode: 'stack',
    height: 480,
  };

  it('écarte le fond, la police et la palette envoyés par l’appelant', () => {
    const l = mergePlotlyLayout(THEME, HOSTILE);
    expect(l.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(l.plot_bgcolor).toBe('rgba(0,0,0,0)');
    expect((l.font as Record<string, unknown>).family).toBe('TestFont');
    expect(l.colorway).not.toEqual(['#ff0000']);
    expect((l.hoverlabel as Record<string, unknown>).bgcolor).toBe('#RAISED');
  });

  it('écarte aussi une couleur de grille imposée sur un axe', () => {
    const l = mergePlotlyLayout(THEME, HOSTILE);
    expect((l.xaxis as Record<string, unknown>).gridcolor).toBe('#GRID');
  });

  it('conserve ce qui relève de la sémantique du graphique', () => {
    const l = mergePlotlyLayout(THEME, HOSTILE);
    expect(l.title).toEqual({ text: 'garde-moi aussi' });
    expect(l.barmode).toBe('stack');
    expect((l.xaxis as Record<string, unknown>).title).toEqual({ text: 'garde-moi' });
  });

  it('conserve ce qui relève de la présentation', () => {
    const l = mergePlotlyLayout(THEME, HOSTILE);
    expect(l.height).toBe(480);
  });

  it('résiste à une clé inconnue émise par une version future de l’agent', () => {
    // La chrome est réappliquée EN DERNIER, inconditionnellement : c'est ce
    // détail d'ordre qui rend la garantie durable plutôt que ponctuelle.
    const l = mergePlotlyLayout(THEME, { ...HOSTILE, template: { layout: { paper_bgcolor: 'white' } } });
    expect(l.paper_bgcolor).toBe('rgba(0,0,0,0)');
    expect(l.template).toBeUndefined();
  });

  it('accepte une mise en page vide', () => {
    expect(() => mergePlotlyLayout(THEME)).not.toThrow();
    expect(mergePlotlyLayout(THEME).paper_bgcolor).toBe('rgba(0,0,0,0)');
  });
});
