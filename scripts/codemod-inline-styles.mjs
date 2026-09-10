#!/usr/bin/env node
/**
 * Codemod : `style={{ color: 'var(--text-x)' }}` -> classe semantique.
 *
 * Ces styles inline ne sont pas faux — ils lisent les bons tokens — mais ils
 * coutent trois choses :
 *   - ils battent toute classe, donc un consommateur ne peut rien surcharger ;
 *   - ils ne peuvent exprimer ni `hover:` ni `dark:` ni aucun etat ;
 *   - ils echappent a tailwind-merge, donc deux d'entre eux se marchent dessus
 *     silencieusement.
 *
 * Ne traite que les declarations ENTIEREMENT couvertes par la table : un
 * `style` qui contient autre chose (une largeur calculee, un delai
 * d'animation) est laisse intact, c'est du style genuinement dynamique.
 *
 * Usage : node scripts/codemod-inline-styles.mjs [--write] <chemin…>
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';

/** Declaration CSS-en-JS -> classe utilitaire. */
const DECL = new Map(Object.entries({
  "color: 'var(--text-primary)'": 'text-primary',
  "color: 'var(--text-secondary)'": 'text-secondary',
  "color: 'var(--text-muted)'": 'text-muted',
  "background: 'var(--surface)'": 'bg-surface',
  "background: 'var(--surface-secondary)'": 'bg-surface-2',
  "background: 'var(--surface-raised)'": 'bg-raised',
  "background: 'var(--hover-overlay)'": 'bg-hover',
  "background: 'var(--sl-purple)'": 'bg-accent',
  "backgroundColor: 'var(--surface)'": 'bg-surface',
  "borderColor: 'var(--border)'": 'border-line',
  "borderColor: 'var(--border-subtle)'": 'border-subtle',
  "borderColor: 'var(--border-strong)'": 'border-strong',
  "border: '1px solid var(--border)'": 'border border-line',
  "border: '1px solid var(--border-subtle)'": 'border border-subtle',
  "letterSpacing: '0.06em'": 'tracking-[0.06em]',
  'fontWeight: 600': 'font-semibold',
}));

const args = process.argv.slice(2);
const write = args.includes('--write');
const roots = args.filter((a) => !a.startsWith('--'));
const files = roots.flatMap((r) => (r.endsWith('.tsx') ? [r] : globSync(`${r}/**/*.tsx`)));

let converted = 0;
let skipped = 0;

for (const file of files) {
  const before = readFileSync(file, 'utf8');

  const after = before.replace(
    /(className=(?:"([^"]*)"|\{`([^`]*)`\}))?(\s*)style=\{\{ ([^{}]*?) \}\}/g,
    (whole, classAttr, dq, tpl, gap, decls) => {
      const parts = decls.split(',').map((d) => d.trim()).filter(Boolean);
      const mapped = parts.map((d) => DECL.get(d));
      // Tout ou rien : un seul fragment non couvert et on laisse la
      // declaration intacte, plutot que d'en scinder la moitie en classes.
      if (mapped.some((m) => !m)) { skipped += 1; return whole; }

      converted += 1;
      const added = mapped.join(' ');
      if (!classAttr) return `${gap}className="${added}"`.replace(/^\s*/, ' ');
      if (dq !== undefined) return `className="${dq} ${added}"`;
      return `className={\`${tpl} ${added}\`}`;
    },
  );

  if (after === before) continue;
  if (write) writeFileSync(file, after);
  console.log(`  ${file}`);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${converted} styles convertis, ${skipped} laisses (dynamiques ou hors table)`);
