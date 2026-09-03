'use client';

/**
 * A table of contents for the open screen — not a tab bar.
 *
 * The distinction is the whole point of the restructure. A tab bar is mutually exclusive, so
 * putting one here would reproduce, one level down, the defect of the eleven panes: you could
 * only ever see one thing. This rail hides nothing. It says what is on the screen, marks where
 * you are, and jumps.
 *
 * Horizontal and sticky rather than a side column: `.app-sidebar` is fixed-width with no media
 * query, so a second vertical rail would squeeze the content it is meant to serve — and a strip
 * needs no separate mobile treatment.
 */

import { useEffect, useState } from 'react';
import type { ComparisonPanel } from './comparisonRoutes';

export interface RailEntry {
  panel: ComparisonPanel;
  label: string;
}

interface Props {
  entries: RailEntry[];
  /** Resets the highlight when the screen changes under the same rail. */
  viewKey: string;
}

export default function SectionRail({ entries, viewKey }: Props) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observed = entries
      .map(({ panel }) => document.getElementById(panel))
      .filter((element): element is HTMLElement => element !== null);
    if (observed.length === 0) return;

    // A band just below the sticky header: a section counts as "where you are" when it crosses
    // that band, not when it merely touches the viewport edge.
    const observer = new IntersectionObserver(
      (mutations) => {
        const entered = mutations.filter((m) => m.isIntersecting);
        if (entered.length === 0) return;
        // Topmost of those currently in the band, so scrolling up feels right too.
        const top = entered.reduce((best, m) =>
          m.boundingClientRect.top < best.boundingClientRect.top ? m : best
        );
        setActive(top.target.id);
      },
      { rootMargin: '-90px 0px -70% 0px' }
    );

    observed.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [entries, viewKey]);

  if (entries.length < 2) return null;

  return (
    <nav
      aria-label="Sections of this screen"
      data-testid="section-rail"
      className="sticky z-10 -mx-1 flex gap-1 overflow-x-auto px-1 py-2"
      style={{
        top: 'calc(var(--topbar-height) + 8px)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {entries.map(({ panel, label }) => {
        const isActive = active === panel;
        return (
          <a
            key={panel}
            href={`#${panel}`}
            aria-current={isActive ? 'true' : undefined}
            className="whitespace-nowrap px-2.5 py-1 text-xs"
            style={{
              borderRadius: 'var(--radius-control)',
              color: isActive ? 'var(--sl-teal-dark)' : 'var(--text-secondary)',
              background: isActive
                ? 'color-mix(in srgb, var(--sl-teal) 12%, transparent)'
                : 'transparent',
              fontWeight: isActive ? 600 : 400,
            }}
          >
            {label}
          </a>
        );
      })}
    </nav>
  );
}
