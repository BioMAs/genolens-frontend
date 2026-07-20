import type { Metadata } from "next";
import { Poppins, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ChatModeProvider } from "@/contexts/ChatModeContext";
import AppFrame from "@/components/AppFrame";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/getUserRole";

// "Skin Stack" redesign: Poppins is the display/heading font, Geist the body font.
// The CSS variable slots keep their historical names (--font-syne = display,
// --font-dm-sans = body) so the many existing var(--font-*) references keep working.
const displayFont = Poppins({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const bodyFont = Geist({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GenoLens — Transcriptomics Platform",
  description: "Advanced transcriptomics data visualization and analysis powered by AI",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: string | null = null;
  if (user) {
    userRole = await getUserRole(user.id);
  }

  return (
    <html lang="en" className="h-full">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <ChatModeProvider>
                {user ? (
                  <AppFrame user={user} userRole={userRole}>
                    {children}
                  </AppFrame>
                ) : (
                  <main>{children}</main>
                )}
              </ChatModeProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
