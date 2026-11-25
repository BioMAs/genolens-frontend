import { readFileSync } from 'node:fs';

/**
 * La typographie de base de la Lentille (spec § 2.2), lue dans les sources.
 *
 * Trois choses qui ne se voient pas dans un diff de composant et qui reviendraient sans bruit :
 * la taille du corps, l'etiquette `.eyebrow`, et la police des titres de page.
 */
const css = readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Le corps d'une regle, par selecteur exact. */
function rule(selector: string): string {
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (sel.split(';').pop()?.trim() === selector) return body;
  }
  throw new Error(`regle ${selector} introuvable`);
}

describe('corps du texte — 16 px', () => {
  it('le cran `body` de l’échelle vaut 1rem', () => {
    expect(css).toMatch(/--text-body:\s*1rem;/);
  });

  it('la règle `body` pose 1rem', () => {
    expect(rule('body')).toMatch(/font-size:\s*1rem;/);
  });

  it('ne touche pas aux crans plus petits', () => {
    expect(css).toMatch(/--text-body-sm:\s*0\.8125rem;/);
    expect(css).toMatch(/--text-caption:\s*0\.75rem;/);
  });
});

describe('.eyebrow — casse de phrase, sans capitales ni crénage', () => {
  const body = rule('.eyebrow');

  it('ne passe pas en capitales', () => {
    expect(body).toMatch(/text-transform:\s*none;/);
    expect(body).not.toMatch(/uppercase/);
  });

  it('n’espace pas les lettres', () => {
    // Tolere un `letter-spacing: 0` explicite, jamais un crenage positif.
    const spacing = /letter-spacing:\s*([^;]+);/.exec(body)?.[1].trim();
    expect(spacing === undefined || /^(0|0em|normal)$/.test(spacing)).toBe(true);
  });

  it('se lit dans la couleur des légendes', () => {
    expect(body).toMatch(/color:\s*var\(--gl-muted\);/);
  });
});

describe('titres de page — Newsreader', () => {
  it.each([
    ['src/components/ui/page-header.tsx'],
    ['src/components/dashboard/DashboardHero.tsx'],
  ])('le <h1> de %s porte font-display', (file) => {
    const h1 = /<h1[\s\S]*?<\/h1>/.exec(readFileSync(file, 'utf8'))?.[0] ?? '';
    expect(h1).toContain('font-display');
  });
});
