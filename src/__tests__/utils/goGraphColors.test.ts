import { fdrToColor, namespaceColor } from '@/utils/goGraphColors';
import { getPalette } from '@/utils/chartPalettes';

/**
 * La rampe de significativite du graphe GO, testee en fonction pure.
 *
 * d3 dessine dans un SVG que jsdom ne met pas en page, et une rampe fausse a
 * l'air d'une rampe. Le raisonnement est celui deja ecrit dans le test de
 * `cytoscapeAdapters` : pousser la decision de couleur dans une fonction qui
 * prend son theme en argument, puis la mesurer.
 */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const h = hex.replace('#', '');
    const [r, g, bl] = [0, 2, 4]
      .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const SURFACE = { light: '#ffffff', dark: '#131720' } as const;
const NAMESPACES = ['biological_process', 'molecular_function', 'cellular_component'];
/** Du plus significatif au moins : c'est l'ordre que la couleur doit refleter. */
const FDRS = [1e-7, 1e-5, 1e-3, 0.03, null];

describe('rampe de significativite', () => {
  /**
   * Le defaut mesure : le fondu visait un gris CLAIR, donc sur fond sombre les
   * termes NON significatifs ressortaient a 12,08:1 et les plus significatifs a
   * 2,85:1. Le bruit criait plus fort que le signal.
   */
  it.each(['light', 'dark'] as const)(
    'perd du contraste a mesure que la significativite baisse (%s)',
    (theme) => {
      for (const ns of NAMESPACES) {
        const palette = getPalette('standard', theme);
        const ramp = FDRS.map((fdr) => contrast(fdrToColor(fdr, ns, palette), SURFACE[theme]));
        for (let i = 1; i < ramp.length; i += 1) {
          expect(ramp[i]).toBeLessThan(ramp[i - 1]);
        }
      }
    },
  );

  it.each(['light', 'dark'] as const)(
    'tient le plancher non-textuel de 3:1 au sommet (%s)',
    (theme) => {
      // Seul le SOMMET doit tenir le plancher : le bas de la rampe recule a
      // dessein, pour la meme raison que `--chart-ns` est bas en contraste.
      for (const ns of NAMESPACES) {
        const palette = getPalette('standard', theme);
        expect(contrast(fdrToColor(1e-7, ns, palette), SURFACE[theme])).toBeGreaterThanOrEqual(3);
      }
    },
  );

  it('rend le gris « non significatif » sans FDR', () => {
    const palette = getPalette('standard', 'light');
    expect(fdrToColor(null, 'biological_process', palette)).toBe(palette.ns);
    expect(fdrToColor(0.5, 'biological_process', palette)).toBe(palette.ns);
  });
});

describe('espaces de noms', () => {
  it('donne trois couleurs distinctes aux trois espaces', () => {
    const palette = getPalette('standard', 'light');
    const used = NAMESPACES.map((ns) => namespaceColor(ns, palette));
    expect(new Set(used).size).toBe(3);
  });

  it("n'emploie pas l'accent interactif comme couleur de donnee", () => {
    // Le premier espace de noms valait `#4f46e5`, l'indigo des controles.
    const palette = getPalette('standard', 'light');
    for (const ns of NAMESPACES) {
      expect(namespaceColor(ns, palette).toLowerCase()).not.toBe('#4f46e5');
    }
  });

  it('retombe sur le gris neutre pour un espace inconnu', () => {
    const palette = getPalette('standard', 'light');
    expect(namespaceColor('something_else', palette)).toBe(palette.ns);
  });
});
