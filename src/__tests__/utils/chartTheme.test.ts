import { clearChartThemeCache, readChartTheme } from '@/utils/chartTheme';
import { toLegacyColor } from '@/utils/colorContrast';

/**
 * La lecture des jetons par `readChartTheme()`.
 *
 * Plotly et cytoscape ne lisent pas `oklch()` : les couleurs lues passent donc par
 * `toLegacyColor`, et sortent en `rgb()`. Une PILE DE POLICES n'est pas une couleur : si elle y
 * passait, `toLegacyColor` la renverrait vide (ou la repeindrait), et la lecture retomberait en
 * silence sur la table de repli — le graphique garderait une police, mais plus celle du jeton.
 * C'est le genre de defaut qu'on ne voit pas a l'oeil, d'ou ce test.
 *
 * jsdom ne resout pas les proprietes personnalisees d'une feuille de style, mais lit celles posees
 * en ligne sur l'element : on les pose sur <html>.
 */
const root = document.documentElement;
const POSED = ['--text-primary', '--font-instrument'] as const;

/** Volontairement differente de la police de repli, pour que la difference se voie. */
const FAMILY = "'Newsreader Test', Georgia, serif";

beforeEach(() => {
  clearChartThemeCache();
  root.classList.remove('dark');
  root.style.setProperty('--text-primary', 'oklch(25% 0.05 292)');
  // Une valeur calculee garde l'espace qui suit les deux-points : la lecture doit le rogner.
  root.style.setProperty('--font-instrument', ` ${FAMILY} `);
});

afterEach(() => {
  POSED.forEach((name) => root.style.removeProperty(name));
  clearChartThemeCache();
});

describe('readChartTheme', () => {
  it('rend une couleur oklch() en rgb(), que Plotly et cytoscape savent lire', () => {
    const { ink } = readChartTheme();

    expect(ink).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
    expect(ink).not.toContain('oklch');
    expect(ink).toBe(toLegacyColor('oklch(25% 0.05 292)'));
  });

  it('rend la famille de police telle quelle, sans la passer par toLegacyColor', () => {
    const { fontFamily } = readChartTheme();

    // `toLegacyColor` rend '' pour une chaine qui n'est pas une couleur : on retomberait alors sur
    // la police de repli (« Instrument Sans »), jamais sur celle du jeton.
    expect(fontFamily).toBe(FAMILY);
    expect(toLegacyColor(FAMILY)).not.toBe(FAMILY);
  });

  it('retombe sur la table de repli pour un jeton absent', () => {
    root.style.removeProperty('--text-primary');
    clearChartThemeCache();

    // jsdom ne declare aucun jeton : c'est la table de repli, claire ici, qui repond.
    expect(readChartTheme().ink).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
