import { comparisonHref } from '@/lib/navigation/comparisonHref';

/**
 * L'adresse de la page d'une comparaison, depuis la liste transversale.
 *
 * Trois ecrans la construisaient chacun de leur cote (les derniers resultats, la
 * file de l'helice, la palette) : le jour ou la route change, un seul est
 * corrige et les deux autres menent a une 404. Un seul constructeur, donc.
 */
describe('comparisonHref', () => {
  it('pointe vers la comparaison du projet', () => {
    expect(comparisonHref({ project_id: 'p1', name: 'Retinol_vs_Vehicle' })).toBe(
      '/projects/p1/comparisons/Retinol_vs_Vehicle',
    );
  });

  it('encode le nom : « / », « # » et l’espace ne doivent pas casser le chemin', () => {
    expect(comparisonHref({ project_id: 'p1', name: 'KO/WT #2' })).toBe(
      '/projects/p1/comparisons/KO%2FWT%20%232',
    );
  });
});
