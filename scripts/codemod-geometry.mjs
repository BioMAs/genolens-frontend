#!/usr/bin/env node
/**
 * Codemod : geometrie — rayons, hauteurs de controle, rythme vertical.
 *
 * Comme les precedents, il ne touche QUE l'interieur des litteraux `className`.
 * Un codemod de la vague 2 operait sur le fichier entier et a mange une classe
 * citee dans un commentaire ; la borne est ici d'emblee.
 *
 * ── Rayons ────────────────────────────────────────────────────────────────
 * Douze valeurs coexistaient. Le jeu retenu est CONCENTRIQUE — exterieur moins
 * retrait egale interieur — donc derivable au lieu d'etre memorise :
 *   sm 6  <  control 10  <  card 16  <  pill
 *
 * `rounded-lg` (8px, 302 usages) va vers `control` et non vers `sm` : c'est le
 * rayon des boutons, champs et pastilles, pas celui d'un detail.
 *
 * `rounded-lg` recouvre en realite DEUX objets : le rayon des controles, et
 * celui de petites cartes. Une premiere version les signalait en vrac — 134
 * cas, donc une liste que personne ne lit. La distinction est mecanique : une
 * surface de fond AVEC un padding d'au moins 12px est une carte ; un controle
 * n'a pas ce rembourrage.
 *
 * ── Hauteurs de controle ──────────────────────────────────────────────────
 * Six hauteurs effectives -> trois : 28 / 36 / 44.
 * BORNE STRICTE aux balises de controle et aux appels `buttonClasses(` :
 * `h-8` a 36 usages dont beaucoup sont des avatars et des tuiles d'icone, ou
 * la hauteur n'a rien a voir avec un controle.
 *
 * ── Rythme vertical ───────────────────────────────────────────────────────
 * Sept valeurs autorisees : 1 2 3 4 6 8 12. Les demi-pas (1.5, 2.5, 3.5) et
 * les valeurs orphelines (5, 7, 9…) remontent au cran voisin.
 *
 * ⚠ Les ecrans de DONNEES sont exemptes. Gonfler l'espacement dans un tableau
 * de genes coute des lignes visibles, ce qui contredit directement la decision
 * « chrome aeree, donnee dense ». La liste est explicite, pas heuristique.
 *
 * Usage :
 *   node scripts/codemod-geometry.mjs --radii   [--write]
 *   node scripts/codemod-geometry.mjs --heights [--write]
 *   node scripts/codemod-geometry.mjs --rhythm  [--write]
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

const RADII = new Map(Object.entries({
  'rounded-sm': 'rounded-sm',
  rounded: 'rounded-sm',
  'rounded-md': 'rounded-sm',
  'rounded-lg': 'rounded-control',
  'rounded-[11px]': 'rounded-control',
  'rounded-xl': 'rounded-card',
  'rounded-2xl': 'rounded-card',
  'rounded-[14px]': 'rounded-card',
  'rounded-[18px]': 'rounded-card',
  'rounded-full': 'rounded-pill',
  // Variantes par cote : memes crans.
  'rounded-l-md': 'rounded-l-sm',
  'rounded-r-md': 'rounded-r-sm',
  'rounded-t-md': 'rounded-t-sm',
  'rounded-b-md': 'rounded-b-sm',
  'rounded-l-lg': 'rounded-l-control',
  'rounded-r-lg': 'rounded-r-control',
  'rounded-t-lg': 'rounded-t-control',
  'rounded-b-lg': 'rounded-b-control',
}));

/** Hauteur -> cran. 44px est aussi le minimum tactile. */
const HEIGHTS = new Map(Object.entries({
  'h-6': 'h-7',
  'h-7': 'h-7',
  'h-8': 'h-9',
  'h-9': 'h-9',
  'h-10': 'h-9',
  'h-11': 'h-11',
  'h-12': 'h-11',
}));

/** Demi-pas et valeurs orphelines -> cran voisin de l'echelle 1 2 3 4 6 8 12. */
const RHYTHM = new Map(Object.entries({
  '0.5': '1', '1.5': '2', '2.5': '3', '3.5': '4',
  '5': '6', '7': '8', '9': '8', '10': '12', '11': '12', '14': '12', '16': '12',
}));
const RHYTHM_PREFIXES = ['gap', 'gap-x', 'gap-y', 'space-x', 'space-y', 'mb', 'mt', 'ml', 'mr'];

/**
 * Ecrans de DONNEES, exemptes du rythme.
 *
 * Etablie en mesurant la densite reelle (tableaux + pas d'espacement serres),
 * pas au jugé. Gonfler ici coute des lignes visibles a un chercheur.
 */
const DATA_REGIME = [
  /\/DEGTable\.tsx$/, /\/GSEATable\.tsx$/, /\/GOEnrichmentTable\.tsx$/,
  /\/MethodStatsPanel\.tsx$/, /\/SampleStatsTable\.tsx$/, /\/MetadataTable\.tsx$/,
  /\/ContrastScatter\.tsx$/, /\/SignatureScorePanel\.tsx$/,
  /\/MultiComparisonVenn\.tsx$/, /\/DatasetExplorer\.tsx$/,
  /\/comparison\/explorer\//, /\/tools\/dd\/.*Table\.tsx$/,
  /\/components\/admin\//, /\/integrations\/StringEnrichmentPanel\.tsx$/,
  /\/comparisons\/AllComparisonsView\.tsx$/, /\/network\/PPINetworkSection\.tsx$/,
];

const EXCLUDED = [
  /__tests__/, /\.test\.tsx?$/,
  // Palette d'authentification : deliberement separee et documentee.
  /\/components\/auth\//, /\/app\/auth\//,
];

const args = process.argv.slice(2);
const write = args.includes('--write');
const mode = args.includes('--radii') ? 'radii'
  : args.includes('--heights') ? 'heights'
  : args.includes('--rhythm') ? 'rhythm'
  : null;
if (!mode) {
  console.error('Preciser --radii, --heights ou --rhythm.');
  process.exit(1);
}

const roots = args.filter((a) => !a.startsWith('--'));
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)));

/** N'agit qu'a l'interieur d'un attribut className. */
function inClassNames(source, transform) {
  return source.replace(
    /(className=(?:"[^"]*"|\{`[^`]*`\}|\{[^{}]*\}))/g,
    (attr) => transform(attr),
  );
}

/** Les litteraux d'un attribut, pour agir token par token. */
function mapLiterals(attr, fn) {
  return attr.replace(/(["'`])((?:\\.|(?!\1)[^\\])*)\1/g, (whole, q, body) =>
    body.includes('=') && !body.includes(' ') ? whole : `${q}${fn(body)}${q}`,
  );
}

let total = 0;
const reviews = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const isData = DATA_REGIME.some((re) => re.test(`/${file}`));
  if (mode === 'rhythm' && isData) continue;

  const after = inClassNames(before, (attr) =>
    mapLiterals(attr, (body) => {
      const isControl = /<(button|input|select|textarea)\b/.test(before) || before.includes('buttonClasses(');
      return body
        .split(/(\s+)/)
        .map((tok) => {
          if (!tok.trim()) return tok;
          const parts = tok.split(':');
          const util = parts.pop();
          const variants = parts;

          if (mode === 'radii') {
            let target = RADII.get(util);
            if (!target || target === util) return tok;

            // `rounded-lg` recouvre deux objets differents : le rayon des
            // controles (bouton, champ, pastille) ET celui de petites cartes.
            // Les distinguer sur une regle mecanique plutot que les signaler
            // en vrac : une surface de fond AVEC un padding d'au moins 12px
            // est une carte — un controle n'a pas ce rembourrage.
            if (util === 'rounded-lg') {
              const onSurface = /\bbg-(surface|surface-2|raised)\b/.test(body);
              const padded = /\bp-(?:[3-9]|1[0-9])\b/.test(body);
              if (onSurface && padded) target = 'rounded-card';
            }

            total += 1;
            return [...variants, target].join(':');
          }

          if (mode === 'heights') {
            if (!isControl) return tok;
            const target = HEIGHTS.get(util);
            if (!target || target === util) return tok;
            // Une hauteur egale a une largeur est une tuile carree, pas un
            // controle : icone, avatar, pastille.
            if (new RegExp(`\\bw-${util.slice(2)}\\b`).test(body)) return tok;
            total += 1;
            return [...variants, target].join(':');
          }

          // rhythm
          const m = util.match(/^(-?)([a-z]+(?:-[xy])?)-([\d.]+)$/);
          if (!m) return tok;
          const [, neg, prefix, value] = m;
          if (!RHYTHM_PREFIXES.includes(prefix)) return tok;
          const target = RHYTHM.get(value);
          if (!target) return tok;
          total += 1;
          return [...variants, `${neg}${prefix}-${target}`].join(':');
        })
        .join('');
    }),
  );

  if (after === before) continue;
  if (write) writeFileSync(file, after);
  console.log(`  ${file}`);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — mode ${mode}, ${total} classes converties`);
if (reviews.length) {
  console.log(`\nA RELIRE — ${reviews.length} cas ambigus :`);
  for (const r of [...new Set(reviews)].slice(0, 15)) console.log(`  ${r}`);
}
