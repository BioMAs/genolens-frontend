#!/usr/bin/env node
/**
 * Codemod : classes Tailwind brutes -> tokens semantiques du @theme.
 *
 * Pourquoi un tokeniser et pas un sed. Les classes visees apparaissent aussi
 * dans des commentaires, des chaines de documentation et des fixtures de test.
 * Un remplacement textuel global les corromprait. Ce script ne touche que les
 * litteraux de chaine situes a l'interieur d'un attribut `className`, ce qui
 * couvre aussi les ternaires (`className={a ? "…" : "…"}`).
 *
 * La regle non evidente — la suppression des jumeaux `dark:`.
 * Certains fichiers portent des paires ecrites a la main :
 *
 *     className="text-gray-700 dark:text-gray-300"
 *
 * Convertir la base rend le jumeau ACTIVEMENT FAUX : --text-primary vaut deja
 * #dde4ee en theme sombre, et le `dark:text-gray-300` viendrait l'ecraser par
 * une valeur figee. Le script supprime donc, dans le meme litteral, tout
 * `dark:` dont la base a ete convertie sur le meme axe. Un `dark:` sans jumeau
 * est signale pour revue, jamais supprime.
 *
 * Usage :
 *   node scripts/codemod-semantic-colors.mjs --dry-run [chemin…]
 *   node scripts/codemod-semantic-colors.mjs --write   [chemin…]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import path from 'node:path';

// ── Table de correspondance ────────────────────────────────────────────────
// Verifiee contre :root ET .dark : chaque ligne resout correctement dans les
// deux themes. Ne jamais mapper vers l'echelle --n-*, dont seuls les crans 0
// a 200 sont redefinis en sombre.
const MAP = new Map(Object.entries({
  // Encre. gray-500 (#6b7280) et gray-600 (#4b5563) fusionnent sur
  // --text-secondary (#5b6472), qui tombe exactement entre les deux.
  'text-gray-900': 'text-primary',
  'text-gray-800': 'text-primary',
  'text-gray-700': 'text-primary',
  'text-gray-600': 'text-secondary',
  'text-gray-500': 'text-secondary',
  'text-gray-400': 'text-muted',
  'text-white': 'text-on-accent',

  // Fonds. Le prefixe hover: est le discriminant qui rend bg-gray-100
  // scriptable : avec, c'est un voile de survol ; sans, un panneau en creux.
  // Identiques en clair, ils divergent en sombre.
  'bg-white': 'bg-surface',
  'bg-gray-50': 'bg-surface-2',
  'bg-gray-100': 'bg-surface-2',

  // Traits
  'border-gray-100': 'border-subtle',
  'border-gray-200': 'border-line',
  'border-gray-300': 'border-strong',
  'divide-gray-100': 'divide-subtle',
  'divide-gray-200': 'divide-line',
  'divide-gray-300': 'divide-strong',

  // Indigo -> accent interactif
  'bg-indigo-50': 'bg-accent-soft',
  'bg-indigo-100': 'bg-accent-soft',
  'bg-indigo-500': 'bg-accent',
  'bg-indigo-600': 'bg-accent',
  'bg-indigo-700': 'bg-accent-hover',
  'text-indigo-500': 'text-accent',
  'text-indigo-600': 'text-accent',
  'text-indigo-700': 'text-accent',
  'text-indigo-800': 'text-accent',
  'border-indigo-200': 'border-accent-ring',
  'border-indigo-300': 'border-accent-ring',
  'border-indigo-500': 'border-accent',
  'border-indigo-600': 'border-accent',
  'ring-indigo-500': 'ring-accent',
  'ring-indigo-600': 'ring-accent',
}));

// Le survol d'un fond gris clair est un voile, pas une surface en creux.
const HOVER_OVERRIDES = new Map(Object.entries({
  'bg-gray-50': 'bg-hover',
  'bg-gray-100': 'bg-hover',
  'bg-gray-200': 'bg-hover',
}));

// Tokens laisses a la revue humaine : ils font souvent deja du clair-sur-sombre
// ou de la donnee (pistes de jauge, puces de graphique, chips sombres voulus).
const REVIEW = new Set([
  'text-gray-300', 'text-gray-200', 'text-gray-100',
  'bg-gray-200', 'bg-gray-300', 'bg-gray-700', 'bg-gray-800', 'bg-gray-900',
  'border-gray-400', 'border-gray-600', 'border-gray-700', 'border-gray-800',
]);

// Exclusions par chemin.
//  - auth : palette .auth-scope deliberement separee et bien faite, elle sert
//    de reference de qualite.
//  - graphiques : ces couleurs sont de la DONNEE, pas de la chrome.
//  - ecrans vitrines : migres a la main, avec leur restructuration.
const EXCLUDED = [
  /\/components\/auth\//,
  /\/app\/login\//, /\/app\/auth\//,
  /\/(EnrichmentRadarPlot|ContrastScatter|DEGBarChart|PCAPlot|UMAPPlot|EnrichmentPlot|EnrichmentHistogram|LibrarySizePlot)\.tsx$/,
  /\/components\/heatmap\//, /\/components\/viz\//, /\/components\/network\//,
  /\/(Dashboard|DashboardKpiBar|DashboardWelcomeBanner|DashboardSubscriptionCard|RecentProjectsSection|QuotaMeters)\.tsx$/,
  /\/dashboard\//,
  /\/(ProjectHub|ComparisonDetail)\.tsx$/,
  /\/components\/comparison\//,
  /__tests__/, /\.test\.tsx?$/,
];

/** Axe d'un token, pour apparier une base et son jumeau dark:. */
function axisOf(token) {
  const parts = token.split(':');
  const utility = parts.pop();
  const variants = parts.filter((v) => v !== 'dark');
  const prefix = utility.match(/^(text|bg|border|divide|ring|from|via|to)-/)?.[1] ?? utility;
  return [...variants, prefix].join(':');
}

/** Convertit une liste de classes. Renvoie {value, converted, reviews}. */
function convertClassList(raw) {
  const tokens = raw.split(/(\s+)/); // conserve les espaces d'origine
  const convertedAxes = new Set();
  const reviews = [];
  let converted = 0;

  // Passe 1 — conversion des bases (tout ce qui n'est pas dark:)
  const out = tokens.map((tok) => {
    if (!tok.trim() || tok.startsWith('dark:')) return tok;
    const parts = tok.split(':');
    const utility = parts.pop();
    const variants = parts;
    const isHover = variants.includes('hover') || variants.includes('group-hover');

    if (REVIEW.has(utility)) {
      reviews.push(tok);
      return tok;
    }
    const target = (isHover && HOVER_OVERRIDES.get(utility)) || MAP.get(utility);
    if (!target) return tok;

    converted += 1;
    const next = [...variants, target].join(':');
    convertedAxes.add(axisOf(next));
    return next;
  });

  // Passe 2 — suppression des jumeaux dark: dont la base vient d'etre
  // convertie. Le token semantique est deja correct dans les deux themes ;
  // laisser le jumeau reviendrait a l'ecraser par une valeur figee.
  let removed = 0;
  const pruned = out.map((tok, i) => {
    if (!tok.trim() || !tok.startsWith('dark:')) return tok;
    if (!convertedAxes.has(axisOf(tok))) {
      reviews.push(`${tok} (dark: sans jumeau converti)`);
      return tok;
    }
    removed += 1;
    // consomme aussi l'espace qui precede, pour ne pas laisser de double espace
    if (i > 0 && !out[i - 1].trim()) out[i - 1] = '';
    return '';
  });

  // Nettoyage des espaces laisses par les tokens retires. On ne touche qu'aux
  // espaces horizontaux : les className multi-lignes gardent leurs retours a
  // la ligne et l'indentation de leurs lignes suivantes.
  const value = pruned
    .join('')
    .replace(/[ \t]+/g, ' ')  // runs d'espaces -> un seul
    .replace(/ +$/gm, '')     // fin de ligne et fin de chaine
    .replace(/^ +/, '');      // debut de chaine uniquement, pas chaque ligne
  return { value, converted, removed, reviews };
}

/**
 * Reecrit les litteraux de chaine d'un fragment de code.
 *
 * Le piege : un template literal peut contenir des interpolations, et une
 * interpolation contient souvent ses propres chaines :
 *
 *     className={`px-4 hover:bg-gray-100 ${sel ? "bg-gray-100" : ""}`}
 *
 * Traiter le corps du template comme une liste de classes avalerait
 * `${sel ? "bg-gray-100" : ""}` et corromprait l'expression JS. Ce scanner
 * ne convertit donc que le texte STATIQUE — celui d'une chaine simple, ou
 * celui d'un template en dehors de ses `${}` — et descend recursivement dans
 * les interpolations pour y traiter les chaines imbriquees.
 */
function rewriteLiterals(code) {
  let out = '';
  let converted = 0;
  let removed = 0;
  const reviews = [];

  const looksLikeClasses = (body) =>
    /(?:^|\s)(?:[a-z-]+:)*(?:text|bg|border|divide|ring)-(?:gray|indigo|white)/.test(` ${body}`);

  const convert = (body) => {
    if (!looksLikeClasses(body)) return body;
    const r = convertClassList(body);
    converted += r.converted;
    removed += r.removed;
    reviews.push(...r.reviews);
    return r.value;
  };

  let i = 0;
  while (i < code.length) {
    const c = code[i];

    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      let body = '';
      while (j < code.length && code[j] !== q) {
        if (code[j] === '\\') { body += code[j] + (code[j + 1] ?? ''); j += 2; continue; }
        body += code[j];
        j += 1;
      }
      out += q + convert(body) + q;
      i = j + 1;
      continue;
    }

    if (c === '`') {
      out += '`';
      let j = i + 1;
      let chunk = '';
      while (j < code.length && code[j] !== '`') {
        if (code[j] === '\\') { chunk += code[j] + (code[j + 1] ?? ''); j += 2; continue; }
        if (code[j] === '$' && code[j + 1] === '{') {
          out += convert(chunk);
          chunk = '';
          // Extrait l'interpolation avec des accolades equilibrees, puis la
          // traite recursivement : elle peut contenir ses propres chaines.
          let depth = 0;
          let k = j;
          for (; k < code.length; k++) {
            if (code[k] === '{') depth += 1;
            else if (code[k] === '}') { depth -= 1; if (depth === 0) { k += 1; break; } }
          }
          const inner = code.slice(j + 2, k - 1);
          const ri = rewriteLiterals(inner);
          converted += ri.converted;
          removed += ri.removed;
          reviews.push(...ri.reviews);
          out += '${' + ri.source + '}';
          j = k;
          continue;
        }
        chunk += code[j];
        j += 1;
      }
      out += convert(chunk) + '`';
      i = j + 1;
      continue;
    }

    out += c;
    i += 1;
  }

  return { source: out, converted, removed, reviews };
}

/**
 * Repere les spans `className=…` et n'y convertit que les litteraux de chaine.
 * Gere `className="…"` et `className={…}` avec accolades equilibrees.
 */
function transform(source) {
  let result = '';
  let cursor = 0;
  let converted = 0;
  let removed = 0;
  const reviews = [];

  const attr = /className=/g;
  let m;
  while ((m = attr.exec(source))) {
    const start = m.index + m[0].length;
    let end;
    if (source[start] === '"' || source[start] === "'") {
      const q = source[start];
      end = source.indexOf(q, start + 1) + 1;
    } else if (source[start] === '{') {
      let depth = 0;
      let i = start;
      let str = null;
      for (; i < source.length; i++) {
        const c = source[i];
        if (str) {
          if (c === '\\') i += 1;
          else if (c === str) str = null;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') str = c;
        else if (c === '{') depth += 1;
        else if (c === '}') {
          depth -= 1;
          if (depth === 0) { i += 1; break; }
        }
      }
      end = i;
    } else {
      continue;
    }

    const span = source.slice(start, end);
    const r = rewriteLiterals(span);
    const rewritten = r.source;
    converted += r.converted;
    removed += r.removed;
    reviews.push(...r.reviews);

    result += source.slice(cursor, start) + rewritten;
    cursor = end;
    attr.lastIndex = end;
  }
  result += source.slice(cursor);
  return { source: result, converted, removed, reviews };
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const write = args.includes('--write');
const targets = args.filter((a) => !a.startsWith('--'));
const roots = targets.length ? targets : ['src'];

// Un argument peut etre un fichier precis (pour inspecter un diff) ou un
// repertoire (pour livrer un lot).
const files = roots
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`, { cwd: process.cwd() })))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f.replace(/\\/g, '/')}`)));

let totalConverted = 0;
let totalRemoved = 0;
let touched = 0;
const allReviews = new Map();

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  const { source, converted, removed, reviews } = transform(before);
  if (reviews.length) allReviews.set(file, reviews);
  if (source === before) continue;
  touched += 1;
  totalConverted += converted;
  totalRemoved += removed;
  if (write) writeFileSync(file, source);
  console.log(`${converted.toString().padStart(4)} conv ${removed.toString().padStart(3)} dark:  ${file}`);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${touched} fichiers, ${totalConverted} classes converties, ${totalRemoved} jumeaux dark: retires`);

if (allReviews.size) {
  const flat = [...allReviews.values()].flat();
  const counts = new Map();
  for (const r of flat) counts.set(r, (counts.get(r) ?? 0) + 1);
  console.log(`\nA REVOIR A LA MAIN — ${flat.length} occurrences dans ${allReviews.size} fichiers :`);
  for (const [tok, n] of [...counts].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    console.log(`  ${n.toString().padStart(4)}  ${tok}`);
  }
}
