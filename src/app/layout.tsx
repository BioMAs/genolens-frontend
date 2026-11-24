import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/components/QueryProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ChatModeProvider } from "@/contexts/ChatModeContext";
import AppFrame from "@/components/AppFrame";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/getUserRole";
import { cn } from '@/lib/cn';

// Trois familles, trois emplois (spec Lentille § 2.2) :
//   - Newsreader (400, 500)         : titres de page, titres de section, grands
//                                     chiffres. Jamais sur un libelle, un bouton,
//                                     une cellule de tableau ni une donnee.
//   - Instrument Sans (400, 500, 600) : toute l'interface.
//   - IBM Plex Mono (400, 500)      : symboles de genes, log2FC, padj, ids, raccourcis.
//
// Les variables sont posees sur <body> par next/font. globals.css les relie aux
// utilitaires Tailwind (font-sans / font-display / font-mono) et garde les
// anciens noms (--font-dm-sans, --font-syne, --font-geist-mono) comme alias, au
// meme endroit : il doit etre sur body, pas sur :root, la ou les variables
// next/font sont definies.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

/**
 * Pose la classe `dark` AVANT le premier paint.
 *
 * `globals.css` ne sélectionne le thème sombre que par la classe `.dark` — pas
 * de `prefers-color-scheme`. Cette classe était posée par un `useEffect` du
 * `ThemeProvider`, donc APRÈS le premier rendu : un utilisateur en thème
 * sombre voyait un flash de thème clair à chaque chargement complet.
 *
 * Ce script s'exécute pendant l'analyse du document, avant que quoi que ce
 * soit ne soit peint. Il duplique volontairement la règle de `resolveTheme`
 * (`src/contexts/ThemeContext.tsx`) : il tourne avant React, il ne peut pas
 * l'importer. Toute modification de l'une doit être reportée dans l'autre.
 *
 * Le `try/catch` n'est pas décoratif : `localStorage` lève en navigation
 * privée sur certains navigateurs, et une exception ici casserait le rendu de
 * toute la page pour une question de couleur.
 */
const THEME_BOOT_SCRIPT = `
try {
  var saved = localStorage.getItem('theme');
  var dark = saved === 'dark' ||
    (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export const metadata: Metadata = {
  title: "GenoLens — Transcriptomics Platform",
  description: "Advanced transcriptomics data visualization and analysis powered by AI",
  // Icons come from the App Router file convention (favicon.ico / icon.png /
  // apple-icon.png / opengraph-image.png in this directory). Declaring them in
  // `icons` as well emits a second, duplicate <link> for favicon.ico, which Next
  // always injects from the convention regardless.
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
    // `suppressHydrationWarning` : le script ci-dessous ajoute une classe sur
    // <html> avant l'hydratation, et c'est le but. Sans ça React signalerait
    // l'attribut `class` comme un écart.
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={cn(
          newsreader.variable,
          instrumentSans.variable,
          plexMono.variable,
          'antialiased'
        )}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
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
