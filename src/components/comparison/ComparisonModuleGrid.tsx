'use client';

import { Check, ChevronRight, Loader2, Lock, X } from 'lucide-react';
import {
  countModuleStates,
  describeModuleStates,
  type ComparisonModule,
} from './comparisonModules';
import type { ComparisonPanel, ComparisonView } from './comparisonRoutes';
import { useModuleAccessRequest } from '@/hooks/useModuleAccessRequest';

interface Props {
  modules: ComparisonModule[];
  /** Opens the module's screen on this same page, scrolled to its section. */
  onOpen: (view: ComparisonView, panel: ComparisonPanel) => void;
  /** Overrides the heading, which differs between the whole catalogue and one group. */
  title?: string;
  /** False when the caller already names the grid — a collapsed block whose summary does. */
  showHeader?: boolean;
}

// Only transform and shadow transition: `transition-all` would also animate the
// colours, which makes a light/dark theme switch visibly crawl across the grid.
const CARD_BASE =
  'flex flex-col rounded-2xl p-4 text-left shadow-sm transition-[transform,box-shadow] duration-200';

function cardStyle(dimmed: boolean): React.CSSProperties {
  return {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    opacity: dimmed ? 0.62 : 1,
  };
}

function ModuleIcon({ module }: { module: ComparisonModule }) {
  const { icon: Icon, state } = module;
  const ready = state === 'ready';
  return (
    <span
      className="grid h-9 w-9 place-items-center rounded-lg"
      style={{
        background: ready ? 'var(--sl-teal-light)' : 'var(--surface-secondary)',
        color: ready ? 'var(--sl-teal-dark)' : 'var(--text-muted)',
      }}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function ModuleBody({ module }: { module: ComparisonModule }) {
  return (
    <>
      <h3
        className="mt-3 font-display text-[14px] font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {module.title}
      </h3>
      <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
        {module.description}
      </p>
    </>
  );
}

/**
 * The modules of a comparison, as cards with an explicit state.
 *
 * Replaces two mute signals in the tab bar: a locked add-on used to have no tab
 * at all, and a module missing its input showed a bare "(N/A)". Here a module
 * always says whether it is ready, what input it is waiting for, or that access
 * can be requested.
 */
export default function ComparisonModuleGrid({
  modules,
  onOpen,
  title = 'Everything this comparison offers',
  showHeader = true,
}: Props) {
  const { request, pending, notice, requested } = useModuleAccessRequest();
  const counts = countModuleStates(modules);

  const summary = describeModuleStates(counts);

  return (
    <section>
      {showHeader ? (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="font-display text-[17px] font-semibold tracking-[-0.3px]"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h2>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
              {summary}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module) => {
          if (module.state === 'ready') {
            const { view, panel } = module;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onOpen(view, panel)}
                aria-label={`Open ${module.title}`}
                className={`${CARD_BASE} group hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
                style={{
                  ...cardStyle(false),
                  // @ts-expect-error CSS custom prop for the focus ring colour
                  '--tw-ring-color': 'var(--sl-teal)',
                }}
              >
                <ModuleIcon module={module} />
                <ModuleBody module={module} />
                {module.metric && (
                  <span
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium"
                    style={{ color: 'var(--sl-teal-dark)' }}
                  >
                    <ChevronRight className="h-3 w-3" />
                    {module.metric}
                  </span>
                )}
              </button>
            );
          }

          if (module.state === 'needs-data') {
            return (
              <div
                key={module.id}
                aria-disabled
                className={CARD_BASE}
                style={cardStyle(true)}
              >
                <ModuleIcon module={module} />
                <ModuleBody module={module} />
                <span className="mt-2 text-[11.5px] font-medium" style={{ color: 'var(--text-muted)' }}>
                  {module.hint}
                </span>
              </div>
            );
          }

          // Locked add-on module
          const alreadyRequested = !!module.addOnId && requested.includes(module.addOnId);
          const sending = !!module.addOnId && pending === module.addOnId;
          return (
            <div key={module.id} className={CARD_BASE} style={cardStyle(true)}>
              <div className="flex items-start justify-between gap-2">
                <ModuleIcon module={module} />
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10.5px] font-semibold"
                  style={{ background: 'var(--surface-secondary)', color: 'var(--text-muted)' }}
                >
                  <Lock className="h-3 w-3" /> {module.hint}
                </span>
              </div>
              <ModuleBody module={module} />
              {module.addOnId && (
                <button
                  type="button"
                  disabled={sending || alreadyRequested}
                  onClick={() => request(module.addOnId!)}
                  className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    borderColor: 'var(--sl-purple-muted)',
                    color: alreadyRequested ? 'var(--text-muted)' : 'var(--sl-purple)',
                    // @ts-expect-error CSS custom prop for the focus ring colour
                    '--tw-ring-color': 'var(--sl-purple)',
                  }}
                >
                  {sending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : alreadyRequested ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Lock className="h-3 w-3" />
                  )}
                  {sending ? 'Sending…' : alreadyRequested ? 'Access requested' : 'Request access'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {notice && (
        <div
          role="status"
          className="mt-3 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm"
          style={
            notice.kind === 'success'
              ? { background: 'var(--sl-teal-light)', borderColor: 'var(--sl-teal-muted)' }
              : { background: 'var(--sl-red-light)', borderColor: 'var(--sl-red-muted)' }
          }
        >
          {notice.kind === 'success' ? (
            <Check className="h-4 w-4" style={{ color: 'var(--sl-teal)' }} />
          ) : (
            <X className="h-4 w-4" style={{ color: 'var(--sl-red-dark)' }} />
          )}
          <span style={{ color: 'var(--text-primary)' }}>{notice.text}</span>
        </div>
      )}
    </section>
  );
}
