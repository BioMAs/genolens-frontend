'use client';

/**
 * The modules of the open screen, behind a disclosure.
 *
 * This used to list the whole catalogue — fourteen cards from any screen. That answered "what
 * exists", which the hub above already answers by counting, and buried the question it was
 * actually good for: of the three or six modules on *this* screen, which are ready and which
 * are out of reach. Scoped to one screen, that is what it shows.
 *
 * Collapsed by default because it is the detail behind a count, not something needed on arrival.
 *
 * The trade is that a locked add-on is requestable only from the screen that holds it. Nothing
 * becomes invisible — the hub reports a screen's locked modules from anywhere — but acting on
 * one costs a click more than it did.
 */

import ComparisonModuleGrid from './ComparisonModuleGrid';
import { describeModuleStates, type ComparisonViewGroup } from './comparisonModules';
import type { ComparisonPanel, ComparisonView } from './comparisonRoutes';

interface Props {
  /** The open screen. Undefined, or holding nothing, renders nothing. */
  group: ComparisonViewGroup | undefined;
  onOpen: (view: ComparisonView, panel: ComparisonPanel) => void;
}

export default function ComparisonModuleDisclosure({ group, onOpen }: Props) {
  // An empty disclosure is a row of furniture with nothing behind it.
  if (!group || group.modules.length === 0) return null;

  return (
    <details className="mt-3 gl-card px-4 py-3">
      <summary
        className="cursor-pointer list-none text-[12.5px] font-semibold"
        style={{ color: 'var(--text-secondary)' }}
      >
        {group.label} modules
        <span className="ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>
          {describeModuleStates(group.counts)}
        </span>
      </summary>
      <div className="mt-4">
        <ComparisonModuleGrid modules={group.modules} onOpen={onOpen} showHeader={false} />
      </div>
    </details>
  );
}
