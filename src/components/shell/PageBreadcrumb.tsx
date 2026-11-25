'use client';

import { usePathname } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import { useBreadcrumbOverride } from '@/contexts/BreadcrumbContext';
import { resolveBreadcrumb } from '@/lib/navigation/breadcrumbs';

/**
 * La premiere ligne de `main` : le fil d'Ariane, juste au-dessus du titre.
 *
 * Il vivait dans la barre de contexte. La barre du haut n'a plus de contexte a
 * porter — marque, destinations, recherche, aide, compte —, et le fil d'Ariane
 * est de la page, pas du chrome : il se lit avec le titre qu'il situe.
 *
 * Client parce qu'il lit l'URL et le contexte de surcharge (`PageHeader` y
 * depose le vrai nom de l'objet) ; `AppShell`, composant serveur, le monte tel
 * quel. Sans surcharge, `resolveBreadcrumb(pathname)` donne toujours une piste
 * correcte.
 *
 * La ligne a la mesure et les gouttieres de la PAGE qu'elle surplombe — les
 * jetons de `.page-container` (`--measure-default`, `--page-gutter`) — et non
 * celles de la barre du haut (1360px, 40px) : son bord gauche est celui du
 * titre, a 1440, a 1024 et a 375px, puisque `--page-gutter` suit les memes
 * paliers que la page. `shell.test.ts` exige que les deux citent les memes
 * jetons. Les ecrans de donnees en mesure `wide` (1600px) restent plus larges
 * que cette ligne ; le jour ou la mesure par defaut change, la ligne la suit.
 */
export default function PageBreadcrumb() {
  const pathname = usePathname();
  const override = useBreadcrumbOverride();
  const crumbs = override ?? resolveBreadcrumb(pathname);

  // Pas de ligne vide : une page qui declare une piste vide n'a pas de fil.
  if (crumbs.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[var(--measure-default)] px-[var(--page-gutter)] pt-4 md:pt-6">
      <Breadcrumb crumbs={crumbs} />
    </div>
  );
}
