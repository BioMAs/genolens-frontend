#!/usr/bin/env node
/**
 * Codemod : les couleurs de CHROME des graphiques vers les tokens.
 *
 * Une couleur de graphique se lit par son ATTRIBUT, pas par sa teinte. Le meme
 * `#94a3b8` est une encre de graduation ici et un trait de reference la ; les
 * mapper sur la meme valeur serait une coincidence, pas une regle.
 *
 * Ce script ne touche donc QUE les roles dont l'attribut ne laisse aucun doute :
 *
 *   <CartesianGrid stroke>, <PolarGrid stroke>   -> grille
 *   <ReferenceLine stroke>                       -> axe
 *   tickLine={{ stroke }}, label={{ fill }}      -> encre
 *   cursor={{ fill }}                            -> voile de survol
 *
 * Les couleurs de SERIE sont laissees : elles encodent de la donnee, et leur
 * choix demande un arbitrage — direction, categorie, ou rampe sequentielle.
 * Les convertir mecaniquement reviendrait a decider a la place de l'auteur.
 *
 * Usage : node scripts/codemod-chart-chrome.mjs [--write] [chemin…]
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

/**
 * `jsx: true` signifie que la valeur remplacee est un ATTRIBUT JSX
 * (`stroke="#fff"`), qui exige des accolades autour de l'expression.
 * `jsx: false` designe une propriete d'objet (`stroke: '#fff'`), ou les
 * accolades seraient une erreur de syntaxe.
 *
 * Une premiere version devinait ce point en cherchant un `:` dans le prefixe
 * capture. Sur une balise multi-lignes, ce prefixe contient les attributs
 * precedents — donc parfois un `:` sans rapport — et la substitution produisait
 * un `stroke=CHART_VARS.axis` sans accolades, syntaxiquement invalide. La
 * distinction est declaree, plus devinee.
 */
const ROLES = [
  // Grille — toujours en retrait, elle ne doit jamais concurrencer la donnee.
  { re: /(<(?:Cartesian|Polar)Grid\b[^>]*?\bstroke=)"#[0-9a-fA-F]{3,6}"/g, token: 'CHART_VARS.grid', jsx: true },
  // Trait de reference — c'est un repere d'axe, pas une serie.
  { re: /(<ReferenceLine\b[\s\S]*?\bstroke=)"#[0-9a-fA-F]{3,6}"/g, token: 'CHART_VARS.axis', jsx: true },
  // Encre des graduations et des libelles d'axe.
  { re: /(\btickLine=\{\{\s*stroke:\s*)'#[0-9a-fA-F]{3,6}'/g, token: 'CHART_VARS.inkMuted', jsx: false },
  { re: /(\bfill:\s*)'#(?:94a3b8|9ca3af|d1d5db)'/g, token: 'CHART_VARS.inkMuted', jsx: false },
  { re: /(\bfill:\s*)'#374151'/g, token: 'CHART_VARS.inkSubtle', jsx: false },
  // Voile de survol.
  { re: /(\bcursor=\{\{\s*fill:\s*)'#[0-9a-fA-F]{3,6}'/g, token: 'CHART_VARS.hover', jsx: false },
  { re: /(\bcursor=\{\{\s*stroke:\s*)'#[0-9a-fA-F]{3,6}'/g, token: 'CHART_VARS.axis', jsx: false },
];

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/components\/auth\//];

const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)));

let total = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let s = before;
  let n = 0;

  for (const { re, token, jsx } of ROLES) {
    s = s.replace(re, (_m, prefix) => {
      n += 1;
      return jsx ? `${prefix}{${token}}` : `${prefix}${token}`;
    });
  }

  if (s === before) continue;
  total += n;

  if (!s.includes("from '@/utils/chartTheme'")) {
    const imports = [...s.matchAll(/^import [\s\S]*?from\s*'[^']+';$/gm)];
    const last = imports[imports.length - 1];
    s = s.slice(0, last.index + last[0].length)
      + "\nimport { CHART_VARS } from '@/utils/chartTheme';"
      + s.slice(last.index + last[0].length);
  } else if (!/\bCHART_VARS\b.*from '@\/utils\/chartTheme'/.test(s)) {
    s = s.replace(/import \{([^}]*)\} from '@\/utils\/chartTheme';/,
      (_m, names) => `import {${names.trimEnd()}, CHART_VARS } from '@/utils/chartTheme';`);
  }

  if (write) writeFileSync(file, s);
  console.log(`${String(n).padStart(3)}  ${file}`);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${total} couleurs de chrome converties`);
