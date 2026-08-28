import GhostVolcano from './GhostVolcano';
import BrandLockup from './BrandLockup';

/**
 * Shared layout for every logged-out screen: login, forgot/reset password,
 * auth-code-error and the account-status page. One implementation so those
 * five surfaces cannot drift apart.
 *
 * Left: the brand panel (lg+ only), grounded in a ghost volcano plot.
 * Right: whatever the screen needs, vertically centred.
 */

const FEATURES = [
  'Differential expression analysis',
  'Pathway enrichment — GO & GSEA',
  'PCA, UMAP & clustering',
  'AI biological interpretation',
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-scope flex min-h-screen" style={{ background: 'var(--auth-bg)' }}>
      {/* ── Brand panel ─────────────────────────────────────── */}
      <aside
        className="relative hidden w-[460px] flex-shrink-0 overflow-hidden lg:grid"
        style={{
          background: 'var(--auth-brand)',
          gridTemplateRows: 'auto 1fr auto',
          padding: '40px 44px',
        }}
      >
        {/* dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        {/* ambient glow */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-20 h-[300px] w-[300px] rounded-full"
          style={{ background: 'var(--auth-panel-accent)', opacity: 0.1, filter: 'blur(80px)' }}
        />
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-[180px] w-[180px] rounded-full"
          style={{ background: 'var(--auth-panel-accent)', opacity: 0.06, filter: 'blur(50px)' }}
        />
        {/* the signature element */}
        <GhostVolcano className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] w-full" />

        <div className="relative z-10">
          <BrandLockup tone="onBrand" />
        </div>

        <div className="relative z-10 flex flex-col justify-center">
          <p
            className="text-[10px] font-bold uppercase"
            style={{ color: 'var(--auth-panel-accent)', letterSpacing: '0.15em' }}
          >
            SciLicium Platform
          </p>
          <h2
            className="font-display mt-3.5 text-[2rem] font-bold leading-[1.15]"
            style={{ color: 'var(--auth-on-brand)', letterSpacing: '-0.01em' }}
          >
            Transcriptomics
            <span style={{ color: 'var(--auth-panel-accent)' }}>,</span>
            <br />
            made intelligible.
          </h2>
          <p
            className="mt-4 max-w-[340px] text-[13.5px] leading-relaxed"
            style={{ color: 'var(--auth-on-brand-2)' }}
          >
            Explore RNA-seq datasets, identify differential expression, and gain
            AI-powered biological insight — all in one workspace.
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-2.5">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{
                    background: 'var(--auth-panel-accent)',
                    boxShadow: '0 0 8px rgba(66,226,186,0.5)',
                  }}
                />
                <span className="text-[13px]" style={{ color: 'var(--auth-on-brand-2)' }}>
                  {feat}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-[11px]" style={{ color: 'var(--auth-on-brand-3)' }}>
          © {new Date().getFullYear()} SciLicium. All rights reserved.
        </p>
      </aside>

      {/* ── Content panel ───────────────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 600px 400px at 100% 0%, rgba(93,88,146,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 w-full max-w-[400px]">
          <div className="mb-7 lg:hidden">
            <BrandLockup size="sm" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
