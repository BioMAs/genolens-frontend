"use client";

import { ReactNode } from "react";
import { Lock, FileText } from "lucide-react";

/** Wraps the demo branding editor with a blur + upsell call-to-action. */
export default function ReportCustomizationLockedOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {/* Demo preview, blurred and non-interactive */}
      <div className="pointer-events-none select-none blur-[3px] opacity-70" aria-hidden>
        {children}
      </div>

      {/* Upsell overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        {/* La pastille et le bandeau etaient peints d'un degrade indigo -> ciel,
            le tic decoratif par excellence ; et le bandeau avait l'allure d'un
            bouton sans en etre un. L'accent plein reste sur le cadenas, le
            bandeau devient ce qu'il est : une indication. */}
        <div className="max-w-md rounded-card border border-subtle bg-surface/95 p-6 text-center shadow-xl backdrop-blur">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill bg-accent-soft">
            <Lock className="h-6 w-6 text-accent-ink" aria-hidden />
          </div>
          <h3 className="text-title" style={{ color: "var(--text-primary)" }}>
            Report customization
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-body-sm" style={{ color: "var(--text-secondary)" }}>
            Brand your PDF reports with your own logo, colours and institute, and set a
            default Material &amp; Methods and conclusion — applied to every report you generate.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-caption" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1 rounded-pill bg-accent-soft px-2.5 py-1 text-accent-ink">
              <FileText className="h-3.5 w-3.5" /> Custom logo
            </span>
            <span className="rounded-pill bg-info-soft px-2.5 py-1 text-info-ink">Brand colours</span>
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-secondary">M&amp;M / conclusion</span>
          </div>
          <p className="mt-6 rounded-control bg-surface-2 px-4 py-2.5 text-body-sm font-medium text-primary">
            Unlock this module — contact your administrator
          </p>
          <p className="mt-2 text-micro" style={{ color: "var(--text-secondary)" }}>
            Preview shown with sample data.
          </p>
        </div>
      </div>
    </div>
  );
}
