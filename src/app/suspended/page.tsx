"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Clock, ShieldOff, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import AuthShell from "@/components/auth/AuthShell";
import AuthCard from "@/components/auth/AuthCard";

type AccountStatus = "suspended" | "cancelled" | "pending" | null;

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

type Entry = {
  badge: string;
  title: string;
  description: string;
  cta: { label: string; href: string };
  icon: typeof Ban;
  tone: "danger" | "brand";
};

const CONTENT: Record<NonNullable<AccountStatus>, Entry> = {
  cancelled: {
    badge: "Subscription expired",
    title: "Your subscription has ended",
    description:
      "Renew your GenoLens plan to regain access to your projects, analyses and data.",
    cta: { label: "Renew subscription", href: "/pricing" },
    icon: ShieldOff,
    tone: "danger",
  },
  suspended: {
    badge: "Account suspended",
    title: "Your account has been suspended",
    description: "Contact our support team and we'll get this sorted out.",
    cta: { label: "Contact support", href: "mailto:support@genolens.com" },
    icon: Ban,
    tone: "danger",
  },
  pending: {
    badge: "Activation pending",
    title: "Your account is awaiting activation",
    description:
      "Check your email for the invitation link, or contact support if it hasn't arrived.",
    // Points at "/" rather than "/login": that route only redirects here anyway.
    cta: { label: "Back to sign in", href: "/" },
    icon: Clock,
    tone: "brand",
  },
};

export default function SuspendedPage() {
  const [status] = useState<AccountStatus>(
    () => getCookieValue("account_status") as AccountStatus
  );

  const current = status ? CONTENT[status] ?? CONTENT.cancelled : CONTENT.cancelled;
  const Icon = current.icon;

  const tone =
    current.tone === "danger"
      ? { bg: "var(--auth-danger-bg)", fg: "var(--auth-danger)" }
      : { bg: "var(--auth-accent-soft)", fg: "var(--auth-accent)" };

  const signOut = async () => {
    document.cookie = "account_status=; path=/; max-age=0";
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <AuthShell>
      <AuthCard className="text-center">
        <div
          className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-[14px]"
          style={{ background: tone.bg, color: tone.fg }}
        >
          <Icon size={26} aria-hidden="true" />
        </div>

        <span
          className="mb-4 inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[9px] font-bold uppercase"
          style={{ background: tone.bg, color: tone.fg, letterSpacing: "0.12em" }}
        >
          {current.badge}
        </span>

        <h1
          className="font-display text-[22px] font-bold"
          style={{ color: "var(--auth-text)", letterSpacing: "-0.02em" }}
        >
          {current.title}
        </h1>
        <p
          className="mx-auto mt-2.5 max-w-[320px] text-[14px] leading-relaxed"
          style={{ color: "var(--auth-text-2)" }}
        >
          {current.description}
        </p>

        <Link href={current.cta.href} className="auth-btn mt-6">
          {current.cta.label}
          <ArrowRight className="auth-btn-arrow h-4 w-4" aria-hidden="true" />
        </Link>

        <button
          type="button"
          onClick={signOut}
          className="auth-link mt-4 text-[13px]"
          style={{ color: "var(--auth-muted)" }}
        >
          Sign out
        </button>
      </AuthCard>
    </AuthShell>
  );
}
