/**
 * `plotly.js-dist-min` ships no types.
 *
 * It is the bundle `react-plotly.js` resolves (next.config aliases
 * `plotly.js/dist/plotly` to it), and it is only called directly for the demo
 * image export (`withDemoImageExport` in `utils/plotlyLayout`), so `toImage` is
 * all the surface that needs declaring. Its signature is the one from
 * `@types/plotly.js`.
 */
declare module 'plotly.js-dist-min' {
  import type { ToImgopts } from 'plotly.js';
  export function toImage(root: HTMLElement, opts?: ToImgopts): Promise<string>;
}
