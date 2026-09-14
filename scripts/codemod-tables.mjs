#!/usr/bin/env node
/**
 * Codemod : les tableaux ecrits a la main vers `.data-table`.
 *
 * Vingt tableaux sur vingt-trois declaraient leur propre densite, leur propre
 * typographie d'en-tete et leurs propres separateurs. Trois hauteurs de ligne
 * coexistaient — ~30, ~36 et ~50px — et le meme ecran pouvait en montrer deux.
 *
 * Le script ne retire QUE ce que la regle `.data-table` redonne :
 *   <table> : la largeur et les separateurs, remplaces par la regle ;
 *   <th>    : padding, casse, graisse, interlettrage, couleur et alignement
 *             a gauche — tous fixes par `.data-table th` ;
 *   <td>    : padding, couleur d'encre et filet de ligne.
 *
 * Tout le reste est CONSERVE : largeurs de colonne, `text-right`, `sticky`,
 * `cursor-pointer`, `font-mono`, `whitespace-nowrap`, classes conditionnelles.
 * Ce sont des decisions par colonne, pas de la densite, et les ecraser serait
 * exactement le genre de balayage qui casse un tableau en silence.
 *
 * Les tableaux dont la classe est CALCULEE (template, ternaire) sont SIGNALES
 * et laisses intacts : leur densite n'est pas lisible statiquement.
 *
 * Usage : node scripts/codemod-tables.mjs [--write] [--verbose] [chemin…]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/auth\//, /Skeletons\.tsx$/];

/**
 * Densite deduite du padding vertical des CELLULES — et uniquement d'elles.
 *
 * Une premiere version mesurait tous les `py-` du fichier, boutons et pastilles
 * compris : `GSEATable` en ressortait « comfortable », c'est-a-dire a 50px par
 * ligne, sur une table de gene sets ou le nombre de lignes visibles EST la
 * fonction. C'est precisement l'inflation de densite que la decision « chrome
 * aeree, donnee dense » interdit.
 *
 * Il n'y a que deux regimes. Le troisieme, a 50px, n'a jamais ete une
 * decision : il vient d'un gabarit d'administration recopie. Lui donner un
 * nom l'aurait perennise.
 */

const DROP_TABLE = /^(min-w-full|w-full|divide-y|divide-[a-z-]+|border-collapse|text-(xs|sm|caption|body-sm))$/;
const DROP_TH = /^(px-[\d.]+|py-[\d.]+|p-[\d.]+|text-left|text-(xs|caption|\[1[01]px\])|font-(medium|semibold|bold)|text-(secondary|muted)|uppercase|tracking-[a-z]+|whitespace-nowrap|border-b|border-[a-z-]+)$/;
const DROP_TD = /^(px-[\d.]+|py-[\d.]+|p-[\d.]+|text-primary|border-b|border-[a-z-]+)$/;

function clean(cls, re) {
  return cls.split(/\s+/).filter((t) => t && !re.test(t)).join(' ').trim();
}

function densityOf(source) {
  const cells = [...source.matchAll(/<t[hd]\s+className="([^"]*)"/g)].map((m) => m[1]);
  const ys = cells
    .flatMap((c) => [...c.matchAll(/\bpy-([\d.]+)\b/g)])
    .map((m) => Number(m[1]));
  if (!ys.length) return null;
  ys.sort((a, b) => a - b);
  const median = ys[Math.floor(ys.length / 2)];
  return median <= 1 ? 'compact' : null;
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
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)) && readFileSync(f, 'utf8').includes('<table'));

let converted = 0;
const skipped = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  if (before.includes('data-table')) continue;

  // Une classe calculee n'est pas lisible statiquement : on signale.
  if (/<table\s+className=\{/.test(before)) {
    skipped.push(`${file} — classe de <table> calculee`);
    continue;
  }
  if (!/<table\s+className="/.test(before)) {
    skipped.push(`${file} — <table> sans className`);
    continue;
  }

  const density = densityOf(before);
  let s = before;

  s = s.replace(/<table\s+className="([^"]*)"/g, (_m, cls) => {
    const rest = clean(cls, DROP_TABLE);
    return `<table className="data-table${rest ? ' ' + rest : ''}"`;
  });
  s = s.replace(/<th(\s+)className="([^"]*)"/g, (m, sp, cls) => {
    const rest = clean(cls, DROP_TH);
    return rest ? `<th${sp}className="${rest}"` : `<th${sp.trimEnd() ? ' ' : ''}`.trimEnd() + ' ';
  });
  s = s.replace(/<td(\s+)className="([^"]*)"/g, (m, sp, cls) => {
    const rest = clean(cls, DROP_TD);
    return rest ? `<td${sp}className="${rest}"` : `<td `;
  });

  if (s === before) continue;
  converted += 1;
  if (verbose) console.log(`  ${density ?? 'defaut'}  ${file}`);
  if (write) writeFileSync(file, s);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${converted} tableaux convertis`);
if (skipped.length) {
  console.log(`${skipped.length} SIGNALES, laisses intacts :`);
  for (const s of skipped) console.log(`   ${s}`);
}
