/**
 * Ce qui doit passer au-dessus de la vue agrandie.
 *
 * La vue agrandie est un `Dialog` plein écran ; tout ce qu'un module qu'elle monte place dans un
 * portail, au niveau du `body`, doit donc se tenir plus haut qu'elle, sans quoi il s'affiche
 * DERRIÈRE le cadre et n'est jamais vu. Lu dans les sources, comme les autres gardes de style :
 * jsdom ne calcule pas d'empilement.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

/** Le `z-[N]` de la première classe qui contient `marker`. */
function layerOf(path: string, marker: RegExp): number {
  const match = source(path).match(marker);
  if (!match) throw new Error(`no layer found in ${path}`);
  return Number(match[1]);
}

describe('layers above the focus view', () => {
  const dialog = layerOf('src/components/ui/dialog.tsx', /fixed inset-0 z-\[(\d+)\]/);

  it('reads the layer of the dialog', () => {
    expect(dialog).toBeGreaterThan(0);
  });

  it('puts the gene tooltip of the GO table, portaled to the body, above the dialog', () => {
    const tooltip = layerOf(
      'src/components/GOEnrichmentTable.tsx',
      /fixed z-\[(\d+)\] pointer-events-none/
    );
    expect(tooltip).toBeGreaterThan(dialog);
  });
});
