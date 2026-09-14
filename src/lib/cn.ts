import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Fusion de classes Tailwind.
 *
 * `clsx` assemble (conditionnels, tableaux, objets), `twMerge` arbitre les
 * conflits pour que la derniere classe gagne. Sans cette seconde etape, le
 * `className` d'un consommateur ne peut pas ecraser les defauts d'une
 * primitive : `<Button className="px-6">` produirait `px-4 px-6` et le
 * resultat dependrait de l'ordre dans la feuille de style. C'est ce qui
 * pousse a re-styler a la main plutot qu'a utiliser les primitives.
 *
 * tailwind-merge ne connait pas les noms declares dans notre `@theme`. Les
 * couleurs passent (`text-primary`, `bg-surface-2`… ont la forme standard des
 * groupes text-color / bg-color), mais pas les valeurs nommees : sans la
 * configuration ci-dessous, `text-body text-title`, `rounded-lg rounded-card`
 * et `shadow-sm shadow-elev-2` conservent leurs DEUX classes, et le rendu
 * final depend de l'ordre dans la feuille de style.
 */
const TYPE_SCALE = [
  'micro',
  'caption',
  'body-sm',
  'body',
  'title',
  'heading',
  'display',
  'hero',
] as const;

/** Rayons et elevations nommes, meme traitement que l'echelle typographique. */
const RADII = ['sm', 'control', 'card', 'pill'] as const;
const ELEVATIONS = ['elev-1', 'elev-2'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPE_SCALE] }],
      rounded: [{ rounded: [...RADII] }],
      'shadow': [{ shadow: [...ELEVATIONS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
