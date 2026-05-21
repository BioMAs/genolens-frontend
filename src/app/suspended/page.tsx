"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

type AccountStatus = "suspended" | "cancelled" | "pending" | null;

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

const CONTENT: Record<NonNullable<AccountStatus>, { title: string; description: string; cta: { label: string; href: string } }> = {
  cancelled: {
    title: "Your subscription has expired",
    description: "Your GenoLens subscription has ended. Renew to regain full access to your projects.",
    cta: { label: "Renew subscription", href: "/pricing" },
  },
  suspended: {
    title: "Your account has been suspended",
    description: "Your account has been temporarily suspended. Please contact support for assistance.",
    cta: { label: "Contact support", href: "mailto:support@genolens.com" },
  },
  pending: {
    title: "Account pending activation",
    description: "Your account is waiting for activation. Please check your email for an invitation link.",
    cta: { label: "Back to login", href: "/login" },
  },
};

export default function SuspendedPage() {
  const [status] = useState<AccountStatus>(() => getCookieValue("account_status") as AccountStatus);

  const current = status ? CONTENT[status] ?? CONTENT.cancelled : CONTENT.cancelled;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">{current.title}</h1>
        <p className="text-gray-500 mb-6 leading-relaxed">{current.description}</p>
        <Link
          href={current.cta.href}
          className="inline-block bg-indigo-600 text-white px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          {current.cta.label}
        </Link>
        <div className="mt-5 flex flex-col gap-2 items-center">
          <button
            onClick={async () => {
              document.cookie = "account_status=; path=/; max-age=0";
              const supabase = createClient();
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="text-sm text-gray-400 hover:text-gray-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
