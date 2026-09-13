#!/usr/bin/env node
/**
 * Codemod : les surfaces ecrites a la main vers les deux niveaux du systeme.
 *
 * `.gl-card` a perdu sa bordure (regle L1 : grouper n'est jamais une raison de
 * border). Les surfaces qui la reproduisent a la main l'ont gardee, et
 * l'application affiche donc deux traitements pour une meme intention.
 *
 * Deux niveaux :
 *   L1 — bloc de contenu.  --surface, rayon, sans bordure, ombre douce.
 *   L2 — couche flottante. Infobulle, menu, popover : sans bordure non plus,
 *        mais un relief bien plus marque, parce qu'elle passe AU-DESSUS.
 *
 * ── Les exemptions, qui font l'essentiel du travail ─────────────────────────
 * La regle n'interdit pas la bordure : elle interdit de border POUR GROUPER.
 * Un filet reste permis si la surface est cliquable, defilable ou editable, ou
 * si elle porte un etat semantique. Une premiere version ignorait ces
 * exemptions et proposait de debordurer des controles segmentes et des zones
 * defilantes — c'est-a-dire de supprimer exactement les filets que la regle
 * autorise. Elles sont donc detectees, comptees, et laissees intactes.
 *
 * Usage : node scripts/codemod-surfaces.mjs [--write] [--verbose] [chemin…]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/auth\//, /\/report\/PageModelSelector/];

/** Une surface : un fond de panneau ET un rayon. Sans les deux, c'est autre chose. */
const SURFACE = /\bbg-(surface|surface-2|raised)\b/;
const RADIUS = /\brounded-(card|control|sm)\b/;
const BORDER_WIDTH = /\bborder(-[0248])?\b(?![-a-z])/;
/** Seuls les filets NEUTRES groupent. Un filet colore porte un etat. */
const NEUTRAL_LINE = /^border-(line|strong|subtle)$/;
const SEMANTIC_LINE = /^border-(accent|danger|warning|success|ai|brand)/;

const FLOATING = /\b(absolute|fixed|shadow-lg|shadow-xl|shadow-2xl|shadow-elev-2)\b/;
const SCROLLABLE = /\b(overflow-(auto|scroll|x-auto|y-auto|x-scroll|y-scroll)|max-h-)/;
const CLICKABLE = /\b(cursor-pointer|hover:|group-hover:|focus:|focus-visible:|peer-)/;
const INTERACTIVE_TAG = /^(button|a|input|select|textarea|label|summary|details)$/i;

function inspect(tag, cls) {
  if (!SURFACE.test(cls) || !RADIUS.test(cls)) return { verdict: 'skip' };
  if (!BORDER_WIDTH.test(cls)) return { verdict: 'skip' };

  const tokens = cls.split(/\s+/);
  if (tokens.some((t) => SEMANTIC_LINE.test(t))) return { verdict: 'exempt', why: 'etat semantique' };
  if (!tokens.some((t) => NEUTRAL_LINE.test(t))) return { verdict: 'exempt', why: 'filet sans jeton neutre' };
  if (INTERACTIVE_TAG.test(tag)) return { verdict: 'exempt', why: `element <${tag}>` };
  if (CLICKABLE.test(cls)) return { verdict: 'exempt', why: 'cliquable' };
  if (SCROLLABLE.test(cls)) return { verdict: 'exempt', why: 'defilable' };

  return { verdict: FLOATING.test(cls) ? 'L2' : 'L1' };
}

function strip(cls, level) {
  const tokens = cls
    .split(/\s+/)
    .filter((t) => !BORDER_WIDTH.test(t) && !NEUTRAL_LINE.test(t));

  // Une couche flottante rejoint AUSSI les jetons du systeme : `shadow-lg` est
  // un defaut Tailwind qui n'existe pas dans l'echelle d'elevation, et
  // `bg-surface` ne se distingue pas de ce qu'elle recouvre. En theme clair
  // --surface-raised vaut --surface, donc la promotion ne change rien ; en
  // sombre elle donne le relief qui manquait.
  if (level === 'L2') {
    return tokens
      .map((t) => (t === 'bg-surface' ? 'bg-raised' : t))
      .map((t) => (/^shadow-(lg|xl|2xl)$/.test(t) ? 'shadow-elev-2' : t))
      .filter((t, i, a) => a.indexOf(t) === i)
      .join(' ')
      .trim();
  }
  return tokens.join(' ').trim();
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
  .filter((f) => !EXCLUDED.some((re) => re.test(`/${f}`)));

const counts = { L1: 0, L2: 0, exempt: 0 };
const exemptions = new Map();
const lines = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let changed = false;

  // La balise porteuse est capturee avec la classe : `<button className=…>` et
  // `<div className=…>` ne relevent pas de la meme regle.
  const after = before.replace(
    /<([A-Za-z][\w.]*)((?:[^>"']|"[^"]*"|'[^']*')*?)className="([^"]*)"/g,
    (whole, tag, mid, cls) => {
      const { verdict, why } = inspect(tag, cls);
      if (verdict === 'skip') return whole;
      if (verdict === 'exempt') {
        counts.exempt += 1;
        exemptions.set(why, (exemptions.get(why) ?? 0) + 1);
        return whole;
      }
      const stripped = strip(cls, verdict);
      if (stripped === cls) return whole;
      changed = true;
      counts[verdict] += 1;
      if (verbose) lines.push(`  ${verdict}  ${file}\n       ${cls}\n    →  ${stripped}`);
      return whole.replace(`className="${cls}"`, `className="${stripped}"`);
    },
  );

  if (changed && write) writeFileSync(file, after);
}

if (verbose) console.log(lines.join('\n'));
console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${counts.L1} blocs L1, ${counts.L2} couches L2`);
console.log(`${counts.exempt} surfaces EXEMPTES, laissees intactes :`);
for (const [why, n] of [...exemptions].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(n).padStart(3)}  ${why}`);
}
