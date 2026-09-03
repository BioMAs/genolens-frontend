export type PaletteMode = 'standard' | 'colorblind';

export const PALETTES = {
  standard: {
    // Up is green and down is red across the app: these are the literal values of the
    // --dc-up / --dc-down tokens, and DEGBarChart records that saying the opposite was a bug
    // it had to fix. This palette still said the opposite (up in red, down in teal), so the
    // volcano and the DEG table contradicted the overview's bar chart on the same comparison.
    up: '#22c55e',
    down: '#ef4444',
    ns: '#d1d5db',
    categorical: [
      '#2A2E5B', '#00BFA5', '#7C3AED', '#ffc658',
      '#ff7300', '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#a4de6c',
    ],
    diverging: {
      negative: '#2166ac',
      zero: '#f7f7f7',
      positive: '#d6604d',
      plotlyScale: 'RdBu' as string | [number, string][],
    },
  },
  // Wong (2011) — safe for deuteranopia, protanopia, tritanopia
  colorblind: {
    up: '#D55E00',
    down: '#0072B2',
    ns: '#999999',
    categorical: [
      '#E69F00', '#56B4E9', '#009E73', '#F0E442',
      '#0072B2', '#D55E00', '#CC79A7', '#000000',
    ],
    diverging: {
      negative: '#0072B2',
      zero: '#f7f7f7',
      positive: '#D55E00',
      plotlyScale: [
        [0, '#0072B2'],
        [0.5, '#f7f7f7'],
        [1, '#D55E00'],
      ] as [number, string][],
    },
  },
};

export function getPalette(mode: PaletteMode) {
  return PALETTES[mode];
}
