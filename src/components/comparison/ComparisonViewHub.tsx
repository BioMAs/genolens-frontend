'use client';

/**
 * The four screens of a comparison, as cards at the top of the results page.
 *
 * Before this, the split existed only in the sidebar, as four 12px text groups nested under
 * "Analyses". From the results page itself you could see the name of the screen you were on and
 * nothing else — not that three others existed, not what they held. A structure nobody can see
 * is not a structure; it is a filing system the author remembers.
 *
 * So the cards are numbered. `VIEW_ORDER` is a sequence, not a set — explore the genes,
 * understand what they mean, apply the comparison, share the result — and numbering is the
 * cheapest way to say so. It also answers the question the old tab bar never could: how much of
 * this comparison have I actually looked at.
 *
 * Deliberately a switcher and not a menu of sections: within a screen the `SectionRail` already
 * lists the sections and marks where you are, so repeating them here would give the same
 * information two heights apart.
 */

import type { ComparisonViewGroup } from './comparisonModules';
import { VIEW_ICONS, type ComparisonView } from './comparisonRoutes';

interface Props {
  /** `groupModulesByView(...)` — all four, in `VIEW_ORDER`. */
  groups: ComparisonViewGroup[];
  activeView: ComparisonView;
  onSelect: (view: ComparisonView) => void;
}

/**
 * What this screen holds, in one line.
 *
 * The section count comes first because it is the useful number; the rest only appears when
 * there is something to explain, so a fully available screen reads "3 sections" and stops.
 */
function summarise({ counts }: ComparisonViewGroup): string {
  const total = counts.ready + counts['needs-data'] + counts.locked;
  if (total === 0) return 'Nothing here for this comparison';

  const parts = [`${total} section${total === 1 ? '' : 's'}`];
  if (counts.locked > 0) parts.push(`${counts.locked} locked`);
  if (counts['needs-data'] > 0) parts.push(`${counts['needs-data']} needs data`);
  return parts.join(' · ');
}

export default function ComparisonViewHub({ groups, activeView, onSelect }: Props) {
  return (
    <nav aria-label="Screens of this comparison">
      <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {groups.map((group, index) => {
          const Icon = VIEW_ICONS[group.view];
          const isActive = group.view === activeView;
          const step = index + 1;

          return (
            <li key={group.view} className="list-none">
              <button
                type="button"
                onClick={() => onSelect(group.view)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Open ${group.label}`}
                className="flex h-full w-full flex-col rounded-2xl p-4 text-left shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background: isActive ? 'var(--sl-teal-light)' : 'var(--surface)',
                  border: `1px solid ${isActive ? 'var(--sl-teal)' : 'var(--border)'}`,
                  // @ts-expect-error CSS custom property for the focus ring colour
                  '--tw-ring-color': 'var(--sl-teal)',
                }}
              >
                <span className="flex items-center justify-between">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-lg"
                    style={{
                      background: isActive ? 'var(--sl-teal)' : 'var(--surface-secondary)',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span
                    className="grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold"
                    // The step is a label, not a control: hidden from the reader, who gets the
                    // same ordering from the list itself.
                    aria-hidden="true"
                    style={{
                      background: isActive ? 'var(--sl-teal)' : 'var(--surface-secondary)',
                      border: isActive ? '1px solid var(--sl-teal)' : '1px solid var(--border)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {step}
                  </span>
                </span>

                <span
                  className={`mt-3 font-display text-[14px] font-semibold${
                    isActive ? ' gl-teal-text' : ''
                  }`}
                  style={isActive ? undefined : { color: 'var(--text-primary)' }}
                >
                  {group.label}
                </span>
                {/* Two cards wide on a phone, so the sentence is the first thing to go. */}
                <span
                  className="mt-0.5 hidden text-[12px] leading-snug sm:block"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {group.description}
                </span>
                <span
                  className={`mt-auto pt-2 text-[11.5px] font-medium${
                    isActive ? ' gl-teal-text' : ''
                  }`}
                  style={isActive ? undefined : { color: 'var(--text-muted)' }}
                >
                  {summarise(group)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
