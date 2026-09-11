import { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

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
 * charge cote page ne peut pas redescendre jusqu'a la TopBar, qui est cliente.
 *
 *   ┌──────────────┬────────────────────────────────────┐
 *   │              │  TopBar (56px) — fil d'Ariane      │
 *   │   Sidebar    ├────────────────────────────────────┤
 *   │   (248px)    │  app-content (defile)              │
 *   │              │  {children}                        │
 *   └──────────────┴────────────────────────────────────┘
 *
 * `topBarRightSlot` a ete retire : AppFrame ne l'a jamais passe.
 */
export default function AppShell({ user, userRole, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar user={user} userRole={userRole} />
      <div className="app-main">
        <TopBar />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
