export type PaletteMode = 'standard' | 'colorblind';
export type ThemeMode = 'light' | 'dark';

export interface Palette {
  up: string;
  down: string;
  ns: string;
  categorical: string[];
  diverging: {
    negative: string;
    zero: string;
    positive: string;
    plotlyScale: string | [number, string][];
  };
}

/**
 * Palette categorielle du mode DALTONISME, construite par optimisation OKLCH.
 *
 * Une par theme : elles n'ont pas la meme surface a affronter, et une palette
 * unique condamne l'une des deux — c'est exactement ce qui faisait echouer
 * trois des huit couleurs de Wong sur blanc.
 *
 * L'ordre porte de l'information : les premiers emplacements sont les plus
 * separes, or la plupart des graphiques du produit n'emploient que trois a
 * cinq series. Mesure sur les sous-ensembles reels — clair : 0,283 a trois
 * series, 0,159 a quatre, 0,150 a cinq.
 */
const CB_LIGHT = [
  '#106118', '#f7419f', '#058dfa', '#783d25',
  '#696ba5', '#127a6b', '#aa6ecd', '#b27402',
];

const CB_DARK = [
  '#058dfa', '#d24011', '#f897c9', '#874e99',
  '#8ec08d', '#706d06', '#eb9f2c', '#b7affd',
];

/**
 * Palette categorielle standard.
 *
 * L'ancienne etait trois couleurs de marque suivies des SEPT couleurs de demo
 * de la documentation Recharts. Mesuree, elle donnait 1,56:1 de contraste
 * minimal sur blanc — sous le plancher — et 0,0273 de separation sous
 * simulation daltonienne.
 *
 * Celle-ci donne 3,03:1 et 0,0852 : meilleure sur LES DEUX axes, ce qui est
 * ce qui justifie de la changer. Elle varie en LUMINOSITE autant qu'en teinte,
 * car une rampe a luminosite constante devient indistinguable en deuteranopie
 * quelle que soit la separation des teintes.
 */
const CATEGORICAL_LIGHT = ['#1a827f', '#789f1f', '#5e38a8', '#863d0d', '#c066c9', '#105f74', '#936816', '#24a876'];

const CATEGORICAL_DARK = ['#8f981f', '#377ee3', '#33dbb7', '#ecb42c', '#de5a8b', '#bc98fa', '#29b2be', '#b654b0'];

/**
 * Les couleurs de donnees, par mode ET par theme.
 *
 * La dependance au theme n'est pas un raffinement : c'etait un DEFAUT MESURE.
 * Les valeurs etaient des litteraux uniques pour les deux themes, ce qui
 * produisait trois problemes verifies au calcul :
 *
 *   1. `up` #22c55e sur blanc donnait 2,28:1, sous le plancher non textuel de
 *      3:1. La couleur « sur-exprime » — le datum central du produit — etait
 *      sous le seuil en theme clair.
 *   2. `ns` #d1d5db sur #131720 donnait 12,17:1 : en theme sombre, les genes
 *      NON SIGNIFICATIFS etaient l'element le plus contraste du nuage de
 *      volcan. Le bruit criait plus fort que le signal.
 *   3. `diverging.zero` #f7f7f7 faisait un trou blanc dans chaque carte de
 *      chaleur sombre.
 *
 * REGLE, a tenir : les couleurs `categorical` encodent du NOMINAL uniquement
 * (groupes d'echantillons, conditions, espaces GO). Elles ne sont jamais
 * employees dans un graphique qui encode aussi une direction — la distance
 * colorimetrique seule n'empecherait pas un orange categoriel de se lire
 * « sous-exprime ».
 */
const PALETTES: Record<PaletteMode, Record<ThemeMode, Palette>> = {
  standard: {
    light: {
      // 3,30:1 et 4,83:1 sur blanc — au-dessus du plancher de 3:1.
      up: '#16a34a',
      down: '#dc2626',
      // Volontairement bas : le non-significatif doit reculer.
      ns: '#c7ccd4',
      categorical: CATEGORICAL_LIGHT,
      diverging: {
        negative: '#2166ac',
        zero: '#f7f7f7',
        positive: '#d6604d',
        plotlyScale: 'RdBu',
      },
    },
    dark: {
      // Sur fond sombre les teintes vives redeviennent lisibles : 7,87:1 et 4,77:1.
      up: '#22c55e',
      down: '#ef4444',
      ns: '#4a5568',
      categorical: CATEGORICAL_DARK,
      diverging: {
        negative: '#5b9bd5',
        // = --surface-raised : le point median se fond dans le panneau au lieu
        // d'y percer un trou blanc.
        zero: '#1c2438',
        positive: '#e07b6a',
        // L'echelle nommee 'RdBu' a un point median BLANC cuit dedans : en
        // sombre elle doit devenir une liste de paliers explicite.
        plotlyScale: [
          [0, '#5b9bd5'],
          [0.5, '#1c2438'],
          [1, '#e07b6a'],
        ],
      },
    },
  },

  /**
   * Mode daltonisme — palette optimisee en OKLCH, en remplacement de Wong 2011.
   *
   * ── La methode, pour que les chiffres soient refaisables ───────────────────
   * Separation d'une paire = distance OKLab, evaluee sous QUATRE visions
   * (normale, deuteranope, protanope, tritanope), et on retient la PIRE.
   * Separation d'une palette = le minimum sur ses 28 paires. Le test
   * `colorblindPalette.test.ts` recalcule tout cela a chaque execution.
   *
   * ── Ce que Wong donnait, et la correction d'un chiffre faux ────────────────
   *                    normal  deuter  protan  tritan   echecs du plancher 3:1
   *   Wong 2011        0,1558  0,0646  0,0897  0,0478   3/8 en clair, 1/8 en sombre
   *   nouvelle claire  0,1190  0,1188  0,1118  0,1153   0/8
   *   nouvelle sombre  0,1213  0,1148  0,1151  0,1179   0/8
   *
   * Le commentaire precedent annoncait « Wong : separation minimale 0,1415 ».
   * Ce chiffre n'est reproductible sous AUCUNE des definitions essayees —
   * min sur les quatre visions (0,0478), sur la vision normale seule (0,1558),
   * sur les trois dichromaties (0,0478), moyenne des paires (0,2945), avec ou
   * sans le noir. Il etait faux, et il a servi a justifier de garder Wong.
   *
   * La lecture ligne a ligne est plus instructive que le total : Wong est
   * excellent en vision NORMALE (0,1558) et s'effondre sous dichromatie
   * (0,0478, soit trois fois moins). Les nouvelles palettes sont PLATES sur
   * les quatre visions — c'est la signature d'une palette qui ne s'appuie pas
   * sur les canaux qu'un dichromate perd.
   *
   * ── Le compromis paye, explicitement ───────────────────────────────────────
   * Une premiere optimisation atteignait 0,1415 / 0,1386 sans contrainte de
   * voisinage. Contraindre la distance au gris `ns` coute 21 % de separation
   * intra-palette et rend le double en distance a ce gris. Ce n'etait pas
   * facultatif : `ns` COEXISTE reellement avec les categories — la PCA
   * l'emploie pour « Unknown » a cote des couleurs de groupe.
   *
   * Les couleurs de DIRECTION ne sont pas contraintes : la regle ecrite plus
   * haut interdit qu'un graphique encode a la fois du nominal et une
   * direction. Les contraindre aussi coutait 36 % de separation pour proteger
   * d'une violation de regle, et non d'un cas reel.
   *
   * Contraintes de la recherche : contraste dans [3,05 ; 8,5] en clair et
   * [3,05 ; 9,5] en sombre — le PLAFOND compte autant que le plancher, trois
   * couleurs a 12:1 sur blanc etant trois noirs pour une vision normale —
   * chroma OKLCH >= 0,09, et 25 degres d'ecart de teinte minimum.
   */
  colorblind: {
    light: {
      up: '#D55E00',
      down: '#0072B2',
      ns: '#c7ccd4',
      categorical: CB_LIGHT,
      diverging: {
        negative: '#0072B2',
        zero: '#f7f7f7',
        positive: '#D55E00',
        plotlyScale: [
          [0, '#0072B2'],
          [0.5, '#f7f7f7'],
          [1, '#D55E00'],
        ],
      },
    },
    dark: {
      up: '#D55E00',
      down: '#56B4E9',
      ns: '#4a5568',
      categorical: CB_DARK,
      diverging: {
        negative: '#56B4E9',
        // Le point median suit la surface : sur fond sombre, #f7f7f7 percait
        // un trou blanc dans chaque carte de chaleur.
        zero: '#1c2438',
        positive: '#D55E00',
        plotlyScale: [
          [0, '#56B4E9'],
          [0.5, '#1c2438'],
          [1, '#D55E00'],
        ],
      },
    },
  },
};

/**
 * La palette, en fonction PURE.
 *
 * `theme` est un parametre et non une lecture du DOM : c'est ce qui rend la
 * fonction testable sans navigateur, et c'est le meme raisonnement que pour
 * `buildPlotlyLayout`.
 */
export function getPalette(mode: PaletteMode, theme: ThemeMode = 'light'): Palette {
  return PALETTES[mode][theme];
}
