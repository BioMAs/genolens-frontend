'use client';

/**
 * The modules of the open screen, one tab each.
 *
 * Replaces the sticky rail of anchors over a long scroll. That rail was the "module header that
 * slides down": it stuck 64px below the top of `.app-content`, which already starts under the
 * top bar, so content scrolled through the gap above it; and each section mounting late pushed
 * the jump target further down the page. One module at a time removes both — nothing above the
 * open panel changes height, and nothing needs to stick.
 *
 * The full ARIA tab pattern this time, unlike `SegmentedControl`: here every tab owns exactly one
 * panel, rendered right below as `role="tabpanel"`, so the tab → panel relation it announces is
 * true. Activation is manual — arrows move focus, Enter or Space opens — because opening a tab
 * mounts its module, and the interaction network or a signature score is not something to build
 * on the way past with an arrow key.
 */

import { useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ComparisonPanel } from './comparisonRoutes';

/** Scroll target for "open this module" from elsewhere on the page. */
export const MODULE_TABS_ID = 'comparison-modules';

/** Id of a module's tab, which its panel names as its label. */
export const moduleTabId = (panel: ComparisonPanel) => `module-tab-${panel}`;

export interface ModuleTab {
  panel: ComparisonPanel;
  label: string;
  icon?: LucideIcon;
}

interface Props {
  tabs: ModuleTab[];
  value: ComparisonPanel | null;
  onValueChange: (panel: ComparisonPanel) => void;
  /** Accessible name of the tab list. */
  label: string;
}

export default function ModuleTabs({ tabs, value, onValueChange, label }: Props) {
  const refs = useRef(new Map<ComparisonPanel, HTMLButtonElement>());

  const focusAt = (index: number) => {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (tab) refs.current.get(tab.panel)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        focusAt(index + 1);
        break;
      case 'ArrowLeft':
        focusAt(index - 1);
        break;
      case 'Home':
        focusAt(0);
        break;
      case 'End':
        focusAt(tabs.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div
      id={MODULE_TABS_ID}
      role="tablist"
      aria-label={label}
      data-testid="module-tabs"
      // Wraps from tablet up — six tabs beside the sidebar overflowed into a scrollbar that cut
      // the last one in half. A phone keeps one swipeable row rather than three stacked ones.
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 pb-2 [scrollbar-width:thin] md:flex-wrap md:overflow-x-visible"
      style={{ scrollMarginTop: 'calc(var(--sticky-top) + 1rem)' }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.panel === value;
        const Icon = tab.icon;
        return (
          <button
            key={tab.panel}
            ref={(node) => {
              if (node) refs.current.set(tab.panel, node);
              else refs.current.delete(tab.panel);
            }}
            type="button"
            role="tab"
            id={moduleTabId(tab.panel)}
            aria-selected={selected}
            // Only the open tab's panel is in the document; pointing the others at an id that
            // does not exist would be a dangling reference.
            aria-controls={selected ? tab.panel : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onValueChange(tab.panel)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap',
              'rounded-control px-3 text-body-sm transition-colors md:min-h-9',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              selected
                ? 'bg-accent-soft font-semibold text-accent-ink'
                : 'text-secondary hover:bg-hover hover:text-primary'
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
