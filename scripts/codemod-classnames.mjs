#!/usr/bin/env node
/**
 * Codemod : les listes de classes construites par gabarit vers `cn()`.
 *
 * `className={`a ${cond ? 'b' : ''}`}` a produit SIX fois le meme defaut dans
 * ce produit : sans espace avant l'interpolation, les deux classes qui se
 * touchent fusionnent en un token invalide et les DEUX sont perdues. Rien ne
 * le signale — ni le compilateur, ni les tests.
 *
 * `cn()` rend la faute impossible, parce qu'il joint ses arguments lui-meme.
 * Il applique en prime `twMerge`, donc une classe repetee ne gagne plus au
 * hasard de l'ordre.
 *
 * Le script ne convertit que ce qu'il peut lire SUREMENT : il extrait les
 * expressions a accolades equilibrees, et refuse tout gabarit dont une
 * expression contient elle-meme un gabarit imbrique. Le reste est signale.
 *
 * Usage : node scripts/codemod-classnames.mjs [--write] [--verbose] [chemin…]
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * La portee `.auth-scope` est exclue : sa consigne est de ne pas y toucher, et
 * `cn()` n'y corrigerait aucun defaut connu. Le benefice ne vaut pas le risque.
 */
const EXCLUDED = [/__tests__/, /\.test\.tsx?$/, /\/auth\//];

/**
 * Decoupe un corps de gabarit en morceaux : chaines litterales et expressions.
 * Retourne `null` si une expression contient un gabarit imbrique — le cas ou
 * l'analyse naive se trompe silencieusement.
 */
function split(body) {
  const parts = [];
  let literal = '';
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '$' && body[i + 1] === '{') {
      parts.push({ type: 'literal', value: literal });
      literal = '';
      let depth = 1;
      let j = i + 2;
      let expr = '';
      while (j < body.length && depth > 0) {
        const c = body[j];
        if (c === '`') return null; // gabarit imbrique : on ne devine pas
        if (c === '{') depth += 1;
        else if (c === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
        expr += c;
        j += 1;
      }
      if (depth !== 0) return null;
      parts.push({ type: 'expr', value: expr });
      i = j;
      continue;
    }
    literal += body[i];
  }
  parts.push({ type: 'literal', value: literal });
  return parts;
}

/** `true` si deux morceaux se touchent sans espace — le defaut d'origine. */
function hasGlue(parts) {
  for (let i = 0; i < parts.length - 1; i += 1) {
    const a = parts[i];
    const b = parts[i + 1];
    if (a.type === 'literal' && b.type === 'expr' && a.value && !/\s$/.test(a.value)) return true;
    if (a.type === 'expr' && b.type === 'literal' && b.value && !/^\s/.test(b.value)) return true;
  }
  return false;
}

function toCall(parts, indent) {
  const args = [];
  for (const part of parts) {
    if (part.type === 'literal') {
      const v = part.value.replace(/\s+/g, ' ').trim();
      if (v) args.push(`'${v.replace(/'/g, "\\'")}'`);
    } else {
      const v = part.value.replace(/\s+/g, ' ').trim();
      if (v) args.push(v);
    }
  }
  if (args.length === 0) return null;
  if (args.length === 1 && args[0].startsWith("'")) return `className=${`{${args[0]}}`}`;
  const oneLine = `className={cn(${args.join(', ')})}`;
  if (oneLine.length + indent <= 100) return oneLine;
  const pad = ' '.repeat(indent + 2);
  return `className={cn(\n${args.map((a) => pad + a).join(',\n')},\n${' '.repeat(indent)})}`;
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

let converted = 0;
let glued = 0;
const skipped = [];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let changed = false;

  const after = before.replace(/([ \t]*)className=\{`([^`]*)`\}/g, (whole, lead, body, offset) => {
    if (!body.includes('${')) return whole;
    const parts = split(body);
    if (!parts) {
      skipped.push(`${file} — gabarit imbrique`);
      return whole;
    }
    const line = before.slice(before.lastIndexOf('\n', offset) + 1, offset);
    const call = toCall(parts, line.length + lead.length);
    if (!call) {
      skipped.push(`${file} — vide apres analyse`);
      return whole;
    }
    if (hasGlue(parts)) glued += 1;
    converted += 1;
    if (verbose) console.log(`  ${file}\n      ${body.replace(/\s+/g, ' ').trim().slice(0, 90)}`);
    return lead + call;
  });

  if (!changed && after === before) continue;
  let result = after;
  if (!/from '@\/lib\/cn'/.test(result) && /\bcn\(/.test(result)) {
    /**
     * Les imports du produit ne sont pas uniformes : guillemets simples ou
     * doubles, avec ou sans point-virgule, et DEUX fichiers n'en ont aucun.
     * Une premiere version n'acceptait qu'une seule de ces formes et
     * abandonnait cinq fichiers — apres les avoir convertis en memoire, donc
     * en les comptant comme faits. L'ancre est desormais posee avant.
     */
    const imports = [...result.matchAll(/^import [\s\S]*?from\s*['"][^'"]+['"];?$/gm)];
    const last = imports[imports.length - 1];
    if (last) {
      const at = last.index + last[0].length;
      result = result.slice(0, at) + "\nimport { cn } from '@/lib/cn';" + result.slice(at);
    } else {
      // Aucun import : on se pose apres la directive de module, si elle existe.
      const directive = /^\s*(['"])use (client|server)\1;?\n/.exec(result);
      const at = directive ? directive[0].length : 0;
      result = result.slice(0, at) + "import { cn } from '@/lib/cn';\n\n" + result.slice(at);
    }
  }
  if (write) writeFileSync(file, result);
}

console.log(`\n${write ? 'ECRIT' : 'SIMULATION'} — ${converted} listes de classes converties`);
console.log(`   dont ${glued} ou deux classes se TOUCHAIENT : le defaut d'origine, corrige au passage`);
if (skipped.length) {
  console.log(`\n${skipped.length} SIGNALES, laisses intacts :`);
  for (const s of [...new Set(skipped)]) console.log(`   ${s}`);
}
