import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import QueryProvider from "@/components/QueryProvider";
import { createClient } from "@/utils/supabase/server";
import { getUserRole } from "@/utils/getUserRole";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenoLens Next",
  description: "Advanced genomic data visualization and analysis platform",
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

  // Get user role if user is authenticated
  let userRole: string | null = null;
  if (user) {
    userRole = await getUserRole(user.id);
  }

  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <QueryProvider>
          <Navbar user={user} userRole={userRole} />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </QueryProvider>
      </body>
    </html>
  );
}
