#!/usr/bin/env node
/**
 * Codemod : les couleurs de STATUT de la palette Tailwind vers les jetons.
 *
 * Le defaut n'est pas l'incoherence, c'est que ces couleurs NE SUIVENT PAS LE
 * THEME. `bg-red-50` vaut #fef2f2 partout : chaque panneau d'erreur de
 * l'application est donc un aplat rose pale au milieu d'une interface sombre.
 * Les jetons `-soft` ont, eux, une variante sombre translucide.
 *
 * Trois familles ont un role sans ambiguite :
 *   rouge                  -> danger
 *   ambre / jaune / orange -> warning
 *   vert / emeraude        -> success
 *
 * Le BLEU est exclu a dessein : il encode tantot un avertissement, tantot une
 * donnee, tantot une categorie — les pastilles d'espace de noms GO en sont. Le
 * convertir en bloc reviendrait a decider a la place de l'auteur, et a peindre
 * une categorie avec une couleur de statut.
 *
 * Usage : node scripts/codemod-status-colors.mjs [--write] [--verbose] [chemin…]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/auth\//, /^src\/app\/page\.tsx$/];

/**
 * Fichiers ou ces teintes encodent une CATEGORIE et non un statut.
 * Les convertir peindrait « molecular function » en avertissement.
 */
const CATEGORICAL = [/GOTreePanel/, /cosmetics\//];

const FAMILIES = {
  red: 'danger',
  green: 'success',
  emerald: 'success',
  amber: 'warning',
  yellow: 'warning',
  orange: 'warning',
};

/**
 * Le cran de gris decide du ROLE, pas seulement de l'intensite :
 *   50 / 100      -> un aplat discret        -> `-soft`
 *   200 / 300     -> un filet                -> le jeton a 30 % d'opacite
 *   400 et au-dela sur du TEXTE              -> `-ink`, seul cran qui tienne
 *                                               le plancher texte de 4,5:1
 *   500 / 600 sur un APLAT                   -> le jeton plein
 */
function mapToken(prefix, family, shade) {
  const token = FAMILIES[family];
  const n = Number(shade);
  if (prefix === 'text' || prefix === 'fill' || prefix === 'stroke') return `${prefix}-${token}-ink`;
  if (prefix === 'border' || prefix === 'divide' || prefix === 'ring') {
    return n <= 300 ? `${prefix}-${token}/30` : `${prefix}-${token}`;
  }
  if (prefix === 'bg') return n <= 100 ? `bg-${token}-soft` : `bg-${token}`;
  return null;
}

const UTILITY = new RegExp(
  String.raw`\b(bg|text|border|ring|divide|fill|stroke)-(${Object.keys(FAMILIES).join('|')})-(\d{2,3})\b`,
  'g',
);
/** `dark:` sur une teinte convertie n'a plus de sens : le jeton porte les deux themes. */
const DARK_SIBLING = new RegExp(
  String.raw`\s*\bdark:(?:hover:|focus:|group-hover:)?(?:bg|text|border|ring|divide|fill|stroke)-(?:${Object.keys(FAMILIES).join('|')})-\d{2,3}\b`,
  'g',
);

const args = process.argv.slice(2);
const write = args.includes('--write');
const verbose = args.includes('--verbose');
const roots = args.filter((a) => !a.startsWith('--'));

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : walk(r)))
  .filter((f) => !EXCLUDED.some((re) => re.test(f)));

const counts = {};
let darkRemoved = 0;
const skipped = [];

for (const file of files) {
  if (CATEGORICAL.some((re) => re.test(file))) {
    if (readFileSync(file, 'utf8').match(UTILITY)) skipped.push(file);
    continue;
  }
  const before = readFileSync(file, 'utf8');

  // Seules les chaines de CLASSE sont touchees : une teinte citee dans un
  // commentaire ou dans une couleur de graphique n'est pas une classe.
  let after = before.replace(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g, (whole, dq, tpl) => {
    const cls = dq ?? tpl;

    // Les freres `dark:` partent AVANT la conversion, pas apres : `\b` matche
    // aussi apres les deux-points, donc `dark:bg-green-900` serait sinon
    // converti en `dark:bg-success` — une seconde couleur, differente de la
    // base, la ou le jeton porte deja les deux themes.
    let next = cls.replace(DARK_SIBLING, () => {
      darkRemoved += 1;
      return '';
    });

    next = next.replace(UTILITY, (m, prefix, family, shade) => {
      const mapped = mapToken(prefix, family, shade);
      if (!mapped) return m;
      counts[`${m} → ${mapped}`] = (counts[`${m} → ${mapped}`] ?? 0) + 1;
      return mapped;
    });
    return next === cls ? whole : whole.replace(cls, next);
  });

  if (after === before) continue;
  if (write) writeFileSync(file, after);
  if (verbose) console.log(`  ${file}`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${total} utilitaires convertis, ${darkRemoved} variantes dark: devenues inutiles`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 18)) {
  console.log(`   ${String(n).padStart(3)}  ${k}`);
}
if (skipped.length) {
  console.log(`\n${skipped.length} fichiers CATEGORIELS laisses intacts :`);
  for (const f of skipped) console.log(`   ${f}`);
}
