import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { TOURS } from '@/lib/tours/registry';

describe('project & analyses tour anchors', () => {
  const rendered = new Set([
    'nav-project',
    'project-overview',
    'analyses-list',
    'analyses-new',
  ]);

  it('project-overview steps reference rendered keys', () => {
    for (const step of TOURS['project-overview'].steps) {
      if (typeof step.element === 'string') {
        const key = step.element.replace(/^\[data-tour="|"\]$/g, '');
        expect(rendered.has(key)).toBe(true);
      }
    }
  });

  it('analyses steps reference rendered keys', () => {
    for (const step of TOURS.analyses.steps) {
      if (typeof step.element === 'string') {
        const key = step.element.replace(/^\[data-tour="|"\]$/g, '');
        expect(rendered.has(key)).toBe(true);
      }
    }
  });
});

/**
 * Les jeux de cles ci-dessus sont ecrits a la main : ils disent ce que le test
 * croit rendu, pas ce qui l'est. C'est ainsi que `sidebar-project` est reste dans
 * le registre apres que la sidebar a ete demontee — la visite du projet ancrait
 * sa premiere etape sur rien, et aucun test ne le voyait.
 *
 * Ce garde lit donc les SOURCES : chaque ancre d'une visite doit etre posee par un
 * `data-tour` quelque part dans le code (hors tests, hors commentaires). Il ne
 * prouve pas que le composant est monte, mais il rattrape le renommage d'un cote
 * seulement, ce qui est la faute qui s'est produite.
 */
describe('every tour anchor is set by a component', () => {
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  const SOURCES = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((f) => join('src', f))
    .filter((f) => /\.tsx$/.test(f) && !f.includes('__tests__') && !f.includes('lentille-lab'))
    .map((f) => stripComments(readFileSync(f, 'utf8')));

  /** `data-tour="key"` en JSX, ou `'data-tour': 'key'` dans un objet d'attributs. */
  const isSet = (key: string): boolean =>
    SOURCES.some((src) => new RegExp(`data-tour["']?\\s*[=:]\\s*["']${key}["']`).test(src));

  const keys = Object.values(TOURS).flatMap((tour) =>
    tour.steps.flatMap((step) =>
      typeof step.element === 'string'
        ? [step.element.replace(/^\[data-tour="|"\]$/g, '')]
        : [],
    ),
  );

  it('temoin positif : les sources sont lues et le scanner reconnait les deux formes', () => {
    expect(SOURCES.length).toBeGreaterThan(200);
    expect(isSet('nav-project')).toBe(true);
    expect(isSet('help-button')).toBe(true);
    expect(isSet('no-such-anchor')).toBe(false);
  });

  it.each([...new Set(keys)])('%s', (key) => {
    expect(isSet(key)).toBe(true);
  });
});
