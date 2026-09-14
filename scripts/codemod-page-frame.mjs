#!/usr/bin/env node
/**
 * Codemod : les enveloppes de page, et les graisses que l'echelle fixe deja.
 *
 * Trois familles de defauts, toutes purement textuelles :
 *
 * 1. `min-h-screen bg-surface-2` (21 sites) — un BUG de theme sombre.
 *    --surface-secondary vaut #171e2c quand --app-bg vaut #0c1018 : ces routes
 *    avaient un fond visiblement plus clair que le dashboard. Et le
 *    `min-h-screen` forcait un second plancher de 100vh a l'interieur de
 *    `.app-content`, qui porte deja overflow-y: auto. Les deux disparaissent.
 *
 * 2. `font-bold` / `font-semibold` sur un cran qui fixe deja son poids.
 *    L'echelle donne display:700, heading:600, title:600, hero:700 ; la classe
 *    en plus est soit redondante, soit en contradiction avec l'echelle.
 *    ATTENTION : `text-heading font-bold` passe de 700 a 600. C'est la
 *    direction voulue, mais c'est un changement VISIBLE, pas un no-op.
 *
 * 3. `tracking-tight` (-0.025em) pose a cote d'un cran qui declare deja le
 *    sien (-0.021em a -0.032em) : deux valeurs qui se battent, la derniere
 *    gagnant par hasard.
 *
 * Usage : node scripts/codemod-page-frame.mjs [--write] [chemin…]
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

/** Crans dont l'echelle fixe deja le poids et le tracking. */
const WEIGHTED_STEPS = ['display', 'heading', 'title', 'micro', 'hero'];
const TRACKED_STEPS = ['display', 'heading', 'title', 'body', 'body-sm', 'caption', 'micro', 'hero'];

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/components\/auth\//, /\/app\/auth\//];

const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)));

let nScreen = 0;
let nWeight = 0;
let nTrack = 0;
const shrinks = [];

/**
 * N'applique les substitutions qu'a l'INTERIEUR des litteraux `className`.
 *
 * Une premiere version operait sur le fichier entier et a mange une classe
 * citee dans un commentaire de documentation — exactement la corruption que le
 * codemod couleur evite en se bornant aux litteraux. Les classes visees
 * apparaissent aussi dans des commentaires et des chaines d'aide.
 */
function inClassNames(source, transform) {
  return source.replace(
    /(className=(?:"[^"]*"|\{`[^`]*`\}|\{[^{}]*\}))/g,
    (attr) => transform(attr),
  );
}

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let s = before;

  s = inClassNames(s, (attr) => {
    let a = attr;

    // 1. L'enveloppe fautive. On retire les deux classes et on laisse le reste
    //    du className intact : la plupart portent aussi un padding, qui devient
    //    redondant avec PageShell mais n'est pas faux.
    a = a.replace(/\bflex flex-col min-h-screen bg-surface-2\b/g, () => {
      nScreen += 1;
      return 'flex flex-col';
    });
    a = a.replace(/\bmin-h-screen bg-surface-2\b ?/g, () => {
      nScreen += 1;
      return '';
    });

    // 2. La graisse que le cran fixe deja.
    for (const step of WEIGHTED_STEPS) {
      const both = new RegExp(`\\btext-${step}\\s+font-(bold|semibold)\\b`, 'g');
      const swapped = new RegExp(`\\bfont-(bold|semibold)\\s+text-${step}\\b`, 'g');
      const note = (w) => {
        nWeight += 1;
        if (w === 'bold' && step !== 'display' && step !== 'hero') {
          shrinks.push(`${file}: text-${step} font-bold (700 -> 600)`);
        }
      };
      a = a.replace(both, (_m, w) => { note(w); return `text-${step}`; });
      a = a.replace(swapped, (_m, w) => { note(w); return `text-${step}`; });
    }

    // 3. Le tracking en double.
    for (const step of TRACKED_STEPS) {
      const x = new RegExp(`\\btext-${step}\\s+tracking-tight\\b`, 'g');
      const y = new RegExp(`\\btracking-tight\\s+text-${step}\\b`, 'g');
      a = a.replace(x, () => { nTrack += 1; return `text-${step}`; });
      a = a.replace(y, () => { nTrack += 1; return `text-${step}`; });
    }

    // Nettoie les espaces laisses par les retraits.
    return a.replace(/"([^"]*)"/g, (m, body) => {
      const cleaned = body.replace(/[ \t]+/g, ' ').replace(/^ | $/g, '');
      return cleaned === body ? m : `"${cleaned}"`;
    });
  });

  if (s === before) continue;
  if (write) writeFileSync(file, s);
  console.log(`  ${file}`);
}

console.log(
  `\n${write ? 'ECRIT' : 'SIMULATION'} — ${nScreen} enveloppes min-h-screen, ` +
    `${nWeight} graisses redondantes, ${nTrack} trackings en double`,
);
if (shrinks.length) {
  console.log(`\nA RELIRE — ${shrinks.length} passages de 700 a 600 (visible, voulu) :`);
  for (const l of shrinks.slice(0, 15)) console.log(`  ${l}`);
  if (shrinks.length > 15) console.log(`  … et ${shrinks.length - 15} autres`);
}
