'use client';

import { Sparkles, FileText, FlaskConical, Check, Lock, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * ModuleSelector — animated add-on module picker (redesign).
 * Three modules: "Claim" (cosmetics / skin-claim scoring), "Reporting"
 * (report customization) and "Science" (advanced scientific tools).
 * Used interactively by admins (toggles call the API) and read-only on a
 * user's own profile.
 */

export type ModuleId = 'claim' | 'reporting' | 'science';

export interface ModuleState {
  claim: boolean;
  reporting: boolean;
  science: boolean;
}

interface ModuleMeta {
  id: ModuleId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  color: string;
  capabilities: string[];
}

export const MODULE_LABELS: Record<ModuleId, string> = {
  claim: 'Skin claims',
  reporting: 'Reporting',
  science: 'Scientific tools',
};

const MODULES: ModuleMeta[] = [
  {
    id: 'claim',
    name: 'Skin claims',
    tagline: 'Turn differential expression into scored cosmetic claims',
    icon: Sparkles,
    color: 'var(--sl-violet)',
    capabilities: [
      'Cosmetic claim scoring (0–100)',
      'Skin-compartment activity — the Skin Stack',
      'AI cosmetic verdict & marketing summary',
      'Skin read surfaced on the dashboard',
    ],
  },
  {
    id: 'reporting',
    name: 'Reporting',
    tagline: 'Branded, fully customizable PDF reports',
    icon: FileText,
    color: 'var(--sl-purple)',
    capabilities: [
      'Custom branding — logo & colors',
      'Editable conclusion & Materials / Methods',
      'Cover page & page-model selection',
      'Export-ready PDF reports',
    ],
  },
  {
    id: 'science',
    name: 'Scientific tools',
    tagline: 'Advanced comparison, enrichment & signature analysis',
    icon: FlaskConical,
    color: 'var(--sl-teal)',
    capabilities: [
      'Ranked GSEA with enrichment plots',
      'Two-contrast log2FC scatter & quadrants',
      'Per-sample signature scoring',
      'Custom gene sets (paste or GMT upload)',
      'DEG patterns across all conditions',
    ],
  },
];

interface Props {
  value: ModuleState;
  onToggle?: (id: ModuleId, enabled: boolean) => void;
  readOnly?: boolean;
  busy?: ModuleId | null;
  /** Read-only mode: called when the user asks for access to a locked module. */
  onRequestAccess?: (id: ModuleId) => void;
}

function ModuleCard({ meta, active, readOnly, busy, onToggle, onRequestAccess }: {
  meta: ModuleMeta;
  active: boolean;
  readOnly: boolean;
  busy: boolean;
  onToggle?: (id: ModuleId, enabled: boolean) => void;
  onRequestAccess?: (id: ModuleId) => void;
}) {
  const { id, name, tagline, icon: Icon, color, capabilities } = meta;
  return (
    <div
      className="relative flex flex-col rounded-[18px] border p-5 transition-all duration-300"
      style={{
        borderColor: active ? `color-mix(in oklab, ${color} 45%, var(--surface))` : 'var(--border)',
        background: active ? `color-mix(in oklab, ${color} 7%, var(--surface))` : 'var(--surface)',
        boxShadow: active ? `0 8px 26px -14px ${color}` : '0 1px 2px rgba(19,22,41,.04)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="grid h-11 w-11 place-items-center rounded-2xl transition-all duration-300"
            style={{
              background: active ? color : `color-mix(in oklab, ${color} 12%, var(--surface))`,
              color: active ? '#fff' : color,
              transform: active ? 'scale(1.04)' : 'scale(1)',
            }}
          >
            <Icon className="h-[22px] w-[22px]" />
          </span>
          <div>
            <div className="font-display text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</div>
            <div className="mt-0.5 text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>{tagline}</div>
          </div>
        </div>

        {/* Toggle / status */}
        {readOnly ? (
          active ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: `color-mix(in oklab, ${color} 14%, var(--surface))`, color }}
            >
              <Check className="h-3 w-3" /> Active
            </span>
          ) : onRequestAccess ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onRequestAccess(id)}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60"
              style={{ borderColor: `color-mix(in oklab, ${color} 35%, var(--surface))`, color }}
            >
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
              {busy ? 'Sending…' : 'Request access'}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'var(--surface-secondary)', color: 'var(--text-muted)' }}>
              <Lock className="h-3 w-3" /> Locked
            </span>
          )
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={active}
            disabled={busy}
            onClick={() => onToggle?.(id, !active)}
            className="relative h-6 w-11 flex-none rounded-full transition-colors duration-300 disabled:opacity-60"
            style={{ background: active ? color : 'var(--border-strong)' }}
            title={active ? `Disable ${name}` : `Enable ${name}`}
          >
            <span
              className="absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all duration-300"
              style={{ left: active ? '22px' : '2px' }}
            >
              {busy && <Loader2 className="h-3 w-3 animate-spin" style={{ color }} />}
            </span>
          </button>
        )}
      </div>

      {/* Capabilities */}
      <ul className="mt-4 flex flex-col gap-2">
        {capabilities.map((cap) => (
          <li key={cap} className="flex items-center gap-2 text-[12.5px] transition-colors duration-300" style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            <span
              className="grid h-4 w-4 flex-none place-items-center rounded-full transition-all duration-300"
              style={{
                background: active ? color : 'var(--surface-secondary)',
                color: active ? '#fff' : 'var(--text-muted)',
              }}
            >
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {cap}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ModuleSelector({ value, onToggle, readOnly = false, busy = null, onRequestAccess }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {MODULES.map((m) => (
        <ModuleCard
          key={m.id}
          meta={m}
          active={value[m.id]}
          readOnly={readOnly}
          busy={busy === m.id}
          onToggle={onToggle}
          onRequestAccess={onRequestAccess}
        />
      ))}
    </div>
  );
}
