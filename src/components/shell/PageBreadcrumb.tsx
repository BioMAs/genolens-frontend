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
 * La ligne a la meme mesure que la barre du haut (1360px centres, marges de
 * 16px puis 40px) : la marque, le fil d'Ariane et — une fois les ecrans
 * recomposes — le titre partagent le meme bord gauche.
 */
export default function PageBreadcrumb() {
  const pathname = usePathname();
  const override = useBreadcrumbOverride();
  const crumbs = override ?? resolveBreadcrumb(pathname);

  // Pas de ligne vide : une page qui declare une piste vide n'a pas de fil.
  if (crumbs.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-4 md:px-10 md:pt-6">
      <Breadcrumb crumbs={crumbs} />
    </div>
  );
}
