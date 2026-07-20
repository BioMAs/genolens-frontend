'use client';

import { User } from '@supabase/supabase-js';
import { useChatMode } from '@/contexts/ChatModeContext';
import { TourProvider } from '@/contexts/TourContext';
import AppShell from '@/components/AppShell';
import ChatModeShell from '@/components/chat/ChatModeShell';
import LicenseExpiredBanner from '@/components/LicenseExpiredBanner';

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
      {chatMode ? (
        <ChatModeShell />
      ) : (
        <AppShell user={user} userRole={userRole}>
          <LicenseExpiredBanner />
          {children}
        </AppShell>
      )}
    </TourProvider>
  );
}
