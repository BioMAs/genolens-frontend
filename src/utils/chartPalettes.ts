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

/** Wong (2011). Voir le commentaire du mode daltonisme pour le compromis. */
const WONG = [
  '#E69F00', '#56B4E9', '#009E73', '#F0E442',
  '#0072B2', '#D55E00', '#CC79A7', '#000000',
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
   * Mode daltonisme — Wong (2011), INCHANGE.
   *
   * J'ai commence par en reecrire les huit couleurs pour corriger leur
   * contraste, puis j'ai mesure le resultat. Verdict, sous simulation
   * deuteranope / protanope / tritanope :
   *
   *   Wong          : separation minimale 0,1415
   *   ma reecriture : separation minimale 0,0110  — treize fois pire
   *
   * J'avais troque la DISTINGUABILITE contre du contraste. C'est un mauvais
   * echange : distinguer les series EST la raison d'etre de ce mode, et un
   * utilisateur daltonien prefere une couleur pale qu'il sait separer d'une
   * autre a une couleur franche qu'il confond avec sa voisine.
   *
   * La tension est reelle et ne se resout pas par une mise a l'echelle de
   * luminosite : Wong tire precisement sa separation de l'amplitude de
   * luminosite qui casse son contraste (mesure, l'ajustement naif tombe a
   * 0,0051). La resoudre demande une optimisation en OKLCH sous les trois
   * simulations — un vrai travail de conception, pas un codemod, et il n'est
   * pas fait ici.
   *
   * DEFAUT CONNU, assume : sur fond blanc #F0E442 donne 1,32:1, #E69F00
   * 2,25:1, #56B4E9 2,31:1 ; sur fond sombre #000000 donne 1,17:1. Ces
   * couleurs restent peu visibles. `ns` et `zero` sont en revanche corriges
   * ci-dessous — ils n'encodent aucune categorie, donc les rendre
   * dependants du theme ne coute aucune separation.
   */
  colorblind: {
    light: {
      up: '#D55E00',
      down: '#0072B2',
      ns: '#c7ccd4',
      categorical: WONG,
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
      categorical: WONG,
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
