#!/usr/bin/env node
/**
 * Codemod : le gris Tailwind vers les jetons neutres.
 *
 * Meme defaut que pour les couleurs de statut, et plus visible encore : un
 * `bg-gray-200` reste un aplat clair fixe quel que soit le theme. Les jetons
 * neutres, eux, s'inversent.
 *
 * Le cran de gris porte le ROLE, et la correspondance n'est pas lineaire :
 * `text-gray-300` sert de separateur — une encre tres discrete — tandis que
 * `bg-gray-300` est un aplat de meme cran mais d'intention opposee. C'est
 * pourquoi la table est indexee par PREFIXE autant que par cran.
 *
 * Usage : node scripts/codemod-neutral-colors.mjs [--write] [--verbose] [chemin…]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/auth\//, /^src\/app\/page\.tsx$/];

const MAP = {
  text: {
    100: 'text-muted', 200: 'text-muted', 300: 'text-muted', 400: 'text-muted',
    500: 'text-muted', 600: 'text-secondary', 700: 'text-secondary',
    800: 'text-primary', 900: 'text-primary',
  },
  placeholder: { 400: 'placeholder-muted', 500: 'placeholder-muted' },
  bg: {
    50: 'bg-surface-2', 100: 'bg-surface-2', 200: 'bg-hover', 300: 'bg-hover',
    // Les crans sombres servaient a simuler un theme sombre a la main.
    // 500 est volontairement ABSENT : il n'existe pas d'aplat neutre a
    // mi-chemin dans le systeme, et le seul jeton de ce cran est une ENCRE.
    // Le site concerne est signale et traite a la main.
    600: 'bg-raised', 700: 'bg-raised', 800: 'bg-surface', 900: 'bg-surface',
  },
  border: { 100: 'border-subtle', 200: 'border-line', 300: 'border-strong', 600: 'border-strong', 700: 'border-strong' },
  divide: { 100: 'divide-subtle', 200: 'divide-line', 300: 'divide-strong' },
  ring: { 200: 'ring-line', 300: 'ring-strong' },
  fill: { 200: 'fill-muted', 300: 'fill-muted', 400: 'fill-muted' },
};

const UTILITY = /\b(bg|text|border|divide|ring|fill|placeholder)-gray-(\d{2,3})\b/g;
const DARK_SIBLING = /\s*\bdark:(?:hover:|focus:|group-hover:|file:)?(?:bg|text|border|divide|ring|fill|placeholder)-gray-\d{2,3}\b/g;

/**
 * Masque les COMMENTAIRES avant toute recherche.
 *
 * Sans cela, un commentaire qui documente le defaut corrige — « une erreur en
 * `text-red-500` » — se fait reecrire et finit par dire l'exacte contraire de
 * ce qui s'est passe. C'est arrive, et c'est la deuxieme fois dans ce projet :
 * un codemod qui touche a la documentation detruit la seule trace du
 * raisonnement.
 */
function maskComments(source) {
  const stash = [];
  const masked = source.replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/[^\n]*/g, (m, pre = '') => {
    const body = pre ? m.slice(pre.length) : m;
    stash.push(body);
    return `${pre}\u0000${stash.length - 1}\u0000`;
  });
  const restore = (s) => s.replace(/\u0000(\d+)\u0000/g, (_m, i) => stash[Number(i)]);
  return { masked, restore };
}

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
const unmapped = {};
let darkRemoved = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const { masked, restore } = maskComments(before);
  /**
   * Toute chaine litterale qui ressemble a une liste de classes, et pas
   * seulement les attributs `className="…"`.
   *
   * Une premiere version n'en couvrait que l'attribut, et manquait les deux
   * tiers : ces utilitaires vivent surtout dans des ternaires, des appels
   * `cn()` et des tables de correspondance — precisement les endroits ou une
   * couleur se decide, donc ceux qui comptent. Le garde-fou est l'exigence
   * d'un SECOND utilitaire connu dans la meme chaine : « bg-gray-200 » seul
   * dans une phrase de commentaire n'est pas une classe.
   */
  const LOOKS_LIKE_CLASSES = /\b(?:flex|grid|inline|rounded|px-|py-|p-|mt-|mb-|gap-|text-|bg-|border|w-|h-|hover:|font-|items-|justify-|shadow|absolute|relative|block)\b/;

  const after = masked.replace(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g, (whole, quote, body) => {
    if (!UTILITY.test(body)) return whole;
    UTILITY.lastIndex = 0;
    if (!LOOKS_LIKE_CLASSES.test(body)) return whole;
    const cls = body;
    let next = cls.replace(DARK_SIBLING, () => {
      darkRemoved += 1;
      return '';
    });
    next = next.replace(UTILITY, (m, prefix, shade) => {
      const mapped = MAP[prefix]?.[Number(shade)];
      if (!mapped) {
        unmapped[m] = (unmapped[m] ?? 0) + 1;
        return m;
      }
      counts[`${m} → ${mapped}`] = (counts[`${m} → ${mapped}`] ?? 0) + 1;
      return mapped;
    });
    return next === cls ? whole : quote + next + quote;
  });
  const result = restore(after);
  if (result === before) continue;
  if (write) writeFileSync(file, result);
  if (verbose) console.log(`  ${file}`);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${total} utilitaires convertis, ${darkRemoved} variantes dark: devenues inutiles`);
for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${k}`);
if (Object.keys(unmapped).length) {
  console.log('\nNON CARTOGRAPHIES, laisses intacts :');
  for (const [k, n] of Object.entries(unmapped)) console.log(`   ${String(n).padStart(3)}  ${k}`);
}
