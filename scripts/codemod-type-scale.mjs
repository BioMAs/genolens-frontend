#!/usr/bin/env node
/**
 * Codemod : tailles de police -> les 7 crans du @theme.
 *
 * Le code portait 162 tailles arbitraires sur 18 valeurs distinctes, dont des
 * demi-pixels (text-[11.5px], text-[12.5px], text-[14.5px]). Des demi-pixels
 * sont la signature d'un reglage a la main, cran par cran, sans echelle : il
 * n'existe aucune raison de composition pour distinguer 11px de 11,5px, et
 * l'ecart ne se voit pas — mais il empeche deux composants d'etre certainement
 * alignes.
 *
 * L'echelle apporte aussi ce que les tailles brutes ne portaient pas : un
 * interligne et un tracking par cran. C'est le tracking negatif croissant qui
 * distingue un titrage premium d'un rendu web par defaut.
 *
 * Prudence deliberee sur deux points :
 *  - `text-[14px]`/`text-[14.5px]` descendent a 13px (body-sm) : c'est le seul
 *    endroit ou la conversion reduit la taille. Signale, pas silencieux.
 *  - Les classes de graphiques (axes, etiquettes Recharts/Plotly) sont
 *    exclues : leur taille est calibree sur la densite du trace, pas sur la
 *    typographie de l'interface.
 *
 * Usage : node scripts/codemod-type-scale.mjs [--write] [chemin…]
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

/** Tailles arbitraires -> cran. */
const ARBITRARY = new Map(Object.entries({
  'text-[9px]': 'text-micro',
  'text-[10px]': 'text-micro',
  'text-[10.5px]': 'text-micro',
  'text-[11px]': 'text-micro',
  'text-[11.5px]': 'text-micro',
  'text-[12px]': 'text-caption',
  'text-[12.5px]': 'text-caption',
  'text-[13px]': 'text-body-sm',
  'text-[13.5px]': 'text-body-sm',
  'text-[14px]': 'text-body-sm',
  'text-[14.5px]': 'text-body-sm',
  'text-[15px]': 'text-body',
  'text-[16.5px]': 'text-body',
  'text-[17px]': 'text-title',
  'text-[19px]': 'text-title',
  'text-[22px]': 'text-heading',
  'text-[24px]': 'text-heading',
  'text-[26px]': 'text-display',
}));

/** Echelle Tailwind par defaut -> cran, pour n'avoir qu'une seule echelle. */
const STOCK = new Map(Object.entries({
  'text-xs': 'text-caption',
  'text-sm': 'text-body-sm',
  'text-base': 'text-body',
  'text-lg': 'text-title',
  'text-xl': 'text-heading',
  'text-2xl': 'text-heading',
  'text-3xl': 'text-display',
  'text-4xl': 'text-display',
  'text-5xl': 'text-hero',
}));

/** Conversions qui REDUISENT la taille : a relire. */
const SHRINKS = new Set(['text-[14px]', 'text-[14.5px]', 'text-[16.5px]', 'text-2xl', 'text-4xl']);

const EXCLUDED = [
  /\/components\/auth\//, /\/app\/login\//, /\/app\/auth\//,
  // Graphiques : la taille y est calibree sur la densite du trace.
  /\/(EnrichmentRadarPlot|ContrastScatter|DEGBarChart|PCAPlot|UMAPPlot|EnrichmentPlot|EnrichmentHistogram|LibrarySizePlot)\.tsx$/,
  /\/components\/heatmap\//, /\/components\/viz\//, /\/components\/network\//,
  /__tests__/, /\.test\.tsx?$/,
];

const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const files = (roots.length ? roots : ['src'])
  .flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)))
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)));

let total = 0;
let touched = 0;
const shrinkSites = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let count = 0;

  // Ancre sur une frontiere de classe pour ne pas toucher un `text-sm` present
  // dans une chaine de documentation. Le ':' et le '!' sont admis en amont :
  // ils portent les variantes (`sm:`, `[&_code]:`) et le marqueur important
  // (`!text-[11px]`), qu'une premiere version laissait passer au travers.
  const apply = (source, table) => {
    let out = source;
    for (const [from, to] of table) {
      const escaped = from.replace(/[[\]().]/g, '\\$&');
      const re = new RegExp(`(?<=["'\`\\s{:!])${escaped}(?=["'\`\\s}])`, 'g');
      out = out.replace(re, () => {
        count += 1;
        if (SHRINKS.has(from)) shrinkSites.push(`${file}: ${from} -> ${to}`);
        return to;
      });
    }
    return out;
  };

  const after = apply(apply(before, ARBITRARY), STOCK);
  if (after === before) continue;
  touched += 1;
  total += count;
  if (write) writeFileSync(file, after);
  console.log(`${String(count).padStart(4)}  ${file}`);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${touched} fichiers, ${total} tailles converties`);
if (shrinkSites.length) {
  console.log(`\nA RELIRE — ${shrinkSites.length} conversions qui reduisent la taille :`);
  for (const s of shrinkSites.slice(0, 20)) console.log(`  ${s}`);
  if (shrinkSites.length > 20) console.log(`  … et ${shrinkSites.length - 20} autres`);
}
