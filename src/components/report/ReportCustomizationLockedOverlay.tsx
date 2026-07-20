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
        <div
          className="max-w-md rounded-2xl border bg-white/95 p-6 text-center shadow-xl backdrop-blur"
          style={{ borderColor: "var(--border-subtle, #e5e7eb)" }}
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg,#4f46e5,#0ea5e9)" }}
          >
            <Lock className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Report customization
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: "var(--text-secondary)" }}>
            Brand your PDF reports with your own logo, colours and institute, and set a
            default Material &amp; Methods and conclusion — applied to every report you generate.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-indigo-700">
              <FileText className="h-3.5 w-3.5" /> Custom logo
            </span>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Brand colours</span>
            <span className="rounded-full bg-teal-50 px-2.5 py-1 text-teal-700">M&amp;M / conclusion</span>
          </div>
          <div
            className="mt-5 rounded-lg px-4 py-2.5 text-sm font-medium text-white"
            style={{ background: "linear-gradient(135deg,#4f46e5,#0ea5e9)" }}
          >
            Unlock this module — contact your administrator
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Preview shown with sample data.
          </p>
        </div>
      </div>
    </div>
  );
}
