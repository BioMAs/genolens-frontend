import { renderHook } from '@testing-library/react';

import { clearChartThemeCache, readChartTheme, useChartTheme } from '@/utils/chartTheme';
import { toLegacyColor } from '@/utils/colorContrast';

let mockTheme: 'light' | 'dark' = 'light';
jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme, toggleTheme: jest.fn(), setTheme: jest.fn() }),
}));

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
 * en ligne sur l'element. On pose les couleurs sur <html>, la ou globals.css les declare, et la
 * police sur <body> : c'est la que next/font pose `--font-instrument` (une classe du <body>), pas sur
 * <html>. Un test qui la posait sur <html> passait pendant que la production retombait toujours sur
 * la police de repli.
 */
const root = document.documentElement;
const body = document.body;

/** Volontairement differente de la police de repli, pour que la difference se voie. */
const FAMILY = "'Newsreader Test', Georgia, serif";

beforeEach(() => {
  clearChartThemeCache();
  mockTheme = 'light';
  root.classList.remove('dark');
  root.style.setProperty('--text-primary', 'oklch(25% 0.05 292)');
  // Une valeur calculee garde l'espace qui suit les deux-points : la lecture doit le rogner.
  body.style.setProperty('--font-instrument', ` ${FAMILY} `);
});

afterEach(() => {
  root.style.removeProperty('--text-primary');
  root.classList.remove('dark');
  body.style.removeProperty('--font-instrument');
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

  it('ne lit la police que sur <body> : une variable posee sur <html> seul ne compte pas', () => {
    // C'est le sens du test ci-dessus, dit a l'envers : la source est <body>, comme en production.
    body.style.removeProperty('--font-instrument');
    root.style.setProperty('--font-instrument', ` ${FAMILY} `);
    clearChartThemeCache();

    expect(readChartTheme().fontFamily).not.toBe(FAMILY);
    root.style.removeProperty('--font-instrument');
  });

  it('retombe sur la table de repli pour un jeton absent', () => {
    root.style.removeProperty('--text-primary');
    clearChartThemeCache();

    // jsdom ne declare aucun jeton : c'est la table de repli, claire ici, qui repond.
    expect(readChartTheme().ink).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('le mode du theme resolu', () => {
  it('suit la classe .dark de <html>, de la lecture jusqu’a l’objet rendu', () => {
    expect(readChartTheme().mode).toBe('light');

    root.classList.add('dark');
    expect(readChartTheme().mode).toBe('dark');

    // Deux caches distincts, un par mode : repasser en clair rend l'objet clair, pas le sombre.
    root.classList.remove('dark');
    expect(readChartTheme().mode).toBe('light');
  });

  it.each(['light', 'dark'] as const)(
    'la table de repli %s porte son mode (premier rendu de useChartTheme)',
    (theme) => {
      mockTheme = theme;
      const seen: Array<ReturnType<typeof useChartTheme>> = [];
      renderHook(() => {
        const resolved = useChartTheme();
        seen.push(resolved);
        return resolved;
      });

      // Le premier rendu sert la table de repli, avant toute lecture du DOM.
      expect(seen[0].mode).toBe(theme);
    },
  );
});
