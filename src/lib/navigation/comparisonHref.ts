/**
 * L'adresse de la page d'une comparaison, depuis la liste transversale.
 *
 * Ni `analysis_id` ni `dataset_id` : la liste globale (`GET /comparisons`) ne
 * connait que le projet et le nom, et la route de projet resout le reste. C'est
 * la route que prenaient deja « Latest results » et la file de l'helice ; la
 * palette de commandes la prend a son tour. Trois constructeurs copies a la main
 * se desynchronisent le jour ou la route change — un seul, ici.
 *
 * Le nom est ENCODE : « KO/WT #2 » ne doit pas couper le chemin en deux ni
 * ouvrir un fragment.
 */
export function comparisonHref(comparison: { project_id: string; name: string }): string {
  return `/projects/${comparison.project_id}/comparisons/${encodeURIComponent(comparison.name)}`;
}
