import type { AppUser } from '@/utils/auth/types';
import PageBreadcrumb from './shell/PageBreadcrumb';
import TopNav from './shell/TopNav';

interface AppShellProps {
  user: AppUser;
  userRole: string | null;
  /**
   * Bandeaux de compte (licence, abonnement, demo), AVANT le fil d'Ariane : le
   * fil se lit avec le titre qu'il situe, un bandeau ne doit pas s'intercaler.
   */
  banners?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * AppShell — la coquille authentifiee.
 *
 * Composant SERVEUR : ni hooks ni API client. C'est ce qui oblige le fil
 * d'Ariane a passer par un contexte plutot que par des props — un nom de projet
 * charge cote page ne peut pas redescendre jusqu'a `PageBreadcrumb`, qui est
 * client.
 *
 *   ┌────────────────────────────────────────────────────┐
 *   │  TopNav (sticky, 64px) — marque, destinations,     │
 *   │  recherche, aide, compte                           │
 *   ├────────────────────────────────────────────────────┤
 *   │  main.app-content                                  │
 *   │    PageBreadcrumb        ← premiere ligne          │
 *   │    {children}                                      │
 *   └────────────────────────────────────────────────────┘
 *
 * Le DOCUMENT defile, a toutes les largeurs : la barre est collee en haut et le
 * contenu passe dessous. Il n'y a plus de conteneur de defilement interne, donc
 * `--sticky-top` (ou colle un element sous la barre) vaut partout
 * `--topbar-height`.
 *
 * `topBarRightSlot` a ete retire : AppFrame ne l'a jamais passe.
 */
export default function AppShell({ user, userRole, banners, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <TopNav user={user} userRole={userRole} />
      <main className="app-content">
        {banners}
        <PageBreadcrumb />
        {children}
      </main>
    </div>
  );
}
