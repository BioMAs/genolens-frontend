import { User } from '@supabase/supabase-js';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface AppShellProps {
  user: User;
  userRole: string | null;
  children: React.ReactNode;
}

/**
 * AppShell — authenticated layout wrapper.
 *
 * Server component: no hooks, no client APIs.
 * Renders Sidebar (client) + TopBar (client) + scrollable content area.
 *
 * Layout:
 *   ┌─────────────┬────────────────────────────────────┐
 *   │             │  TopBar (52px)                     │
 *   │   Sidebar   ├────────────────────────────────────┤
 *   │   (220px)   │  app-content (scrollable)          │
 *   │             │  {children}                        │
 *   └─────────────┴────────────────────────────────────┘
 */
export default function AppShell({ user, userRole, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar user={user} userRole={userRole} />
      <div className="app-main">
        <TopBar />
        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}
