'use client';

import { User } from '@supabase/supabase-js';
import { useChatMode } from '@/contexts/ChatModeContext';
import { TourProvider } from '@/contexts/TourContext';
import AppShell from '@/components/AppShell';
import ChatModeShell from '@/components/chat/ChatModeShell';
import LicenseExpiredBanner from '@/components/LicenseExpiredBanner';
import { BreadcrumbProvider } from '@/contexts/BreadcrumbContext';

/**
 * Client-side frame that swaps the whole authenticated UI between the normal
 * AppShell and the full-screen chat assistant, based on the global chat-mode toggle.
 */
export default function AppFrame({
  user,
  userRole,
  children,
}: {
  user: User;
  userRole: string | null;
  children: React.ReactNode;
}) {
  const { chatMode } = useChatMode();

  return (
    <TourProvider>
      {/* Le fil d'Ariane vit ici, au-dessus d'AppShell : celle-ci est un
          composant serveur, donc un nom charge cote page ne peut pas redescendre
          jusqu'a la TopBar par des props. */}
      <BreadcrumbProvider>
        {chatMode ? (
          <ChatModeShell />
        ) : (
          <AppShell user={user} userRole={userRole}>
            <LicenseExpiredBanner />
            {children}
          </AppShell>
        )}
      </BreadcrumbProvider>
    </TourProvider>
  );
}
