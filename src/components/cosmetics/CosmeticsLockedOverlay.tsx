'use client';

import { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';

/** Wraps the demo preview with a blur + upsell call-to-action. */
export default function CosmeticsLockedOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {/* Demo preview, blurred and non-interactive */}
      <div className="pointer-events-none select-none blur-[3px] opacity-70" aria-hidden>
        {children}
      </div>

      {/* Upsell overlay */}
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          className="max-w-md rounded-card border bg-surface/95 p-6 text-center shadow-xl backdrop-blur"
          style={{ borderColor: 'var(--border-subtle, #e5e7eb)' }}
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-pill"
            style={{ background: 'linear-gradient(135deg,#db2777,#8b5cf6)' }}
          >
            <Lock className="h-6 w-6 text-on-accent" />
          </div>
          <h3 className="text-title" style={{ color: 'var(--text-primary)' }}>
            Cosmetics module
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-body-sm" style={{ color: 'var(--text-secondary)' }}>
            Turn your differential expression results into clear, marketing-ready
            skin-benefit insights: claim scores, an annotated skin map, and an
            AI-written cosmetic interpretation.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-caption" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1 rounded-pill bg-surface-2 px-2.5 py-1 text-secondary">
              <Sparkles className="h-3.5 w-3.5" /> Claim radar
            </span>
            <span className="rounded-pill bg-accent-soft px-2.5 py-1 text-accent-ink">Skin schematic</span>
            <span className="rounded-pill bg-surface-2 px-2.5 py-1 text-secondary">AI narrative</span>
          </div>
          <div
            className="mt-6 rounded-control px-4 py-2.5 text-body-sm font-medium text-on-accent"
            style={{ background: 'linear-gradient(135deg,#db2777,#8b5cf6)' }}
          >
            Unlock this module — contact your administrator
          </div>
          <p className="mt-2 text-micro" style={{ color: 'var(--text-secondary)' }}>
            Preview shown with sample data.
          </p>
        </div>
      </div>
    </div>
  );
}
