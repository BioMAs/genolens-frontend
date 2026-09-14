import { resolveBreadcrumb } from '@/lib/navigation/breadcrumbs';

/**
 * La TopBar dérivait son titre de 19 `if` successifs pour produire UN mot.
 * Sur sept routes ce mot était la même chaîne que le `<h1>` de la page ;
 * sur les autres, un nom générique qui n'apprenait rien.
 *
 * Ce module est le repli : il doit produire une piste correcte à partir de
 * l'URL SEULE, pour qu'une page pas encore migrée reste correctement située.
 */
describe('resolveBreadcrumb', () => {
  const labels = (p: string) => resolveBreadcrumb(p).map((c) => c.label);

  it('situe une route simple', () => {
    expect(labels('/dashboard')).toEqual(['Dashboard']);
    expect(labels('/projects')).toEqual(['Projects']);
  });

  it('construit le chemin complet d’un outil imbriqué', () => {
    expect(labels('/tools/power-analysis')).toEqual(['Tools', 'Power Analysis']);
    expect(resolveBreadcrumb('/tools/power-analysis')[0].href).toBe('/tools');
  });

  it('ne lie jamais la dernière miette', () => {
    const crumbs = resolveBreadcrumb('/tools/power-analysis');
    expect(crumbs[crumbs.length - 1].href).toBeUndefined();
  });

  it('garde l’analyse dans le chemin quand la comparaison passe par elle', () => {
    // La route la plus spécifique doit gagner : sans ça, /analyses/a1/comparisons/x
    // tomberait sur la route projet→comparaison et perdrait l'analyse.
    expect(labels('/projects/p1/analyses/a1/comparisons/KO_vs_WT')).toEqual([
      'Projects',
      'Project',
      'Analysis',
      'KO vs WT',
    ]);
  });

  it('rend lisible un nom de comparaison', () => {
    expect(labels('/projects/p1/comparisons/Treated_vs_Control')).toContain('Treated vs Control');
  });

  it('décode les segments échappés', () => {
    expect(labels('/projects/p1/comparisons/KO%20D14_vs_WT')).toContain('KO D14 vs WT');
  });

  it('reconstruit les href avec les identifiants BRUTS, pas embellis', () => {
    // Un href embelli pointerait vers une route inexistante.
    const crumbs = resolveBreadcrumb('/projects/abc-123/analyses');
    expect(crumbs.find((c) => c.label === 'Project')?.href).toBe('/projects/abc-123');
  });

  it('retombe sur la forme du chemin pour une route inconnue', () => {
    expect(labels('/quelque/chose/inconnu')).toEqual(['Quelque', 'Chose', 'Inconnu']);
  });

  it('renvoie toujours au moins une miette', () => {
    expect(resolveBreadcrumb('/').length).toBeGreaterThan(0);
    expect(resolveBreadcrumb('').length).toBeGreaterThan(0);
  });
});
