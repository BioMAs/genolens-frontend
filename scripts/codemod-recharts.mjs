#!/usr/bin/env node
/**
 * Codemod : les graphiques Recharts sur les defauts communs.
 *
 * Le compte reel, verifie : 10 balises `<Tooltip>` sans `content=`, qui rendent
 * donc la boite blanche par defaut de Recharts — texte quasi noir sur fond
 * blanc, illisible en theme sombre.
 *
 * Ce n'est PAS 21, contrairement a ce que laissait croire le decompte des
 * `contentStyle` : les 9 autres ont un `content=` personnalise, et ces
 * composants-la sont deja thematises (ils portent `bg-surface border-line`,
 * rattrapes par le codemod couleur). Ne pas confondre « ne fixe pas
 * contentStyle » et « rend la boite par defaut ».
 *
 * Pareil pour la grille (sept couleurs differentes en circulation) et les
 * graduations (quatre tailles).
 *
 * Ce codemod opere sur des BALISES JSX et non sur des className : il remplace
 * des attributs entiers. Il est donc volontairement conservateur — il ne touche
 * que les formes qu'il reconnait exactement, et laisse le reste.
 *
 * Usage : node scripts/codemod-recharts.mjs [--write] [chemin…]
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/];

/**
 * Remplace chaque balise `<Nom …>` ou `<Nom … />` en equilibrant les accolades.
 *
 * Une expression reguliere ne peut pas trouver la fin d'une balise JSX dont les
 * attributs contiennent eux-memes des accolades et des chevrons — ce qui est le
 * cas de tout `content={({active}) => …}`.
 */
function replaceTags(source, name, transform) {
  let out = '';
  let cursor = 0;
  const open = new RegExp(`<${name}\\b`, 'g');
  let m;
  while ((m = open.exec(source))) {
    let i = m.index + m[0].length;
    let depth = 0;
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
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) { i += 1; break; }
    }
    const tag = source.slice(m.index, i);
    // Seules les balises auto-fermantes sont traitees : une balise ouvrante a
    // des enfants, donc une substitution ferait perdre son contenu.
    const next = tag.endsWith('/>') ? transform(tag) : tag;
    out += source.slice(cursor, m.index) + next;
    cursor = i;
    open.lastIndex = i;
  }
  return out + source.slice(cursor);
}

const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)))
  .filter((f) => readFileSync(f, 'utf8').includes("from 'recharts'"));

let nTooltip = 0;
let nGrid = 0;
let nAxis = 0;
const skipped = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let s = before;

  // ── Tooltip ──────────────────────────────────────────────────────────────
  // Une balise `<Tooltip>` peut s'etendre sur plusieurs lignes et contenir des
  // accolades imbriquees : une expression reguliere ne suffit pas a en trouver
  // la fin. On equilibre les accolades.
  //
  // Un `content=` deja present est LAISSE : son auteur avait une raison, et
  // l'ecraser ferait perdre de l'information metier.
  s = replaceTags(s, 'Tooltip', (tag) => {
    if (tag.includes('content=')) return tag;
    // Une directive `eslint-disable-next-line` s'ancre a la LIGNE SUIVANTE :
    // aplatir la balise sur une seule ligne la detache de ce qu'elle protege,
    // et fait apparaitre une erreur que quelqu'un avait deliberement tue.
    if (/eslint-disable|@ts-expect-error|@ts-ignore/.test(tag)) {
      skipped.push(`${file} — directive de lint dans la balise`);
      return tag;
    }
    // `formatter` et `labelFormatter` portent du sens metier : on les garde.
    const keep = [...tag.matchAll(/\b(?:formatter|labelFormatter)=\{(?:[^{}]|\{[^{}]*\})*\}/g)]
      .map((m) => m[0])
      .join(' ');
    nTooltip += 1;
    return `<Tooltip content={<ChartTooltip />} cursor={CHART_TOOLTIP_CURSOR}${keep ? ` ${keep}` : ''} />`;
  });

  // ── Grille ───────────────────────────────────────────────────────────────
  s = s.replace(/<CartesianGrid\s*(?:strokeDasharray="[^"]*"\s*)?(?:stroke="[^"]*"\s*)?\/>/g, () => {
    nGrid += 1;
    return '<CartesianGrid {...CHART_GRID} />';
  });
  s = s.replace(/<CartesianGrid\s+stroke="[^"]*"\s+strokeDasharray="[^"]*"\s*\/>/g, () => {
    nGrid += 1;
    return '<CartesianGrid {...CHART_GRID} />';
  });

  // ── Graduations ──────────────────────────────────────────────────────────
  // Seules les formes simples : un `tick` qui porte autre chose qu'une taille
  // et une couleur (un composant de rendu, un angle) est laisse tel quel.
  s = s.replace(
    /\btick=\{\{\s*(?:fontSize:\s*[\d.]+\s*,?\s*)?(?:fill:\s*'[^']*'\s*,?\s*)?(?:fontSize:\s*[\d.]+\s*,?\s*)?\}\}/g,
    (whole) => {
      if (!/fontSize|fill/.test(whole)) return whole;
      nAxis += 1;
      return '{...CHART_AXIS}';
    },
  );

  if (s === before) continue;

  // Import, ajoute une seule fois, apres le dernier import existant.
  const needed = [];
  if (s.includes('<ChartTooltip') || s.includes('ChartTooltip />')) needed.push('ChartTooltip');
  if (s.includes('CHART_TOOLTIP_CURSOR')) needed.push('CHART_TOOLTIP_CURSOR');
  if (s.includes('CHART_GRID')) needed.push('CHART_GRID');
  if (s.includes('CHART_AXIS')) needed.push('CHART_AXIS');

  if (needed.length && !s.includes("from '@/components/charts/rechartsDefaults'")) {
    const imports = [...s.matchAll(/^import [\s\S]*?from\s*'[^']+';$/gm)];
    if (!imports.length) {
      skipped.push(`${file} — aucun import ou s'ancrer`);
      continue;
    }
    const last = imports[imports.length - 1];
    const line = `\nimport { ${[...new Set(needed)].sort().join(', ')} } from '@/components/charts/rechartsDefaults';`;
    s = s.slice(0, last.index + last[0].length) + line + s.slice(last.index + last[0].length);
  }

  if (write) writeFileSync(file, s);
  console.log(`  ${file}`);
}

console.log(
  `\n${write ? 'ECRIT' : 'SIMULATION'} — ${nTooltip} tooltips, ${nGrid} grilles, ${nAxis} axes`,
);
if (skipped.length) {
  console.log(`\nLAISSES : ${skipped.length}`);
  for (const s of skipped) console.log(`  ${s}`);
}
