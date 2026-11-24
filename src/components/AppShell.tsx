import { User } from '@supabase/supabase-js';
import PageBreadcrumb from './shell/PageBreadcrumb';
import TopNav from './shell/TopNav';

interface AppShellProps {
  user: User;
  userRole: string | null;
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
export default function AppShell({ user, userRole, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <TopNav user={user} userRole={userRole} />
      <main className="app-content">
        <PageBreadcrumb />
        {children}
      </main>
    </div>
  );
}
