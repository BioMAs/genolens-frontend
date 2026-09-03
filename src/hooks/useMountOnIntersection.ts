'use client';

/**
 * Defer a section's cost until it is scrolled anywhere near.
 *
 * The three merged screens put four panels on one page instead of one behind each tab, so a
 * panel that used to mount only when its tab was clicked would now mount on arrival. For the
 * cheap ones that is fine; for the ones that build a Plotly canvas or ask the backend for an
 * ancestor traversal it is a cost the tabbed version never paid.
 *
 * The answer is mounting discipline, not tabs — tabs would put the panels back behind an
 * exclusive switch, which is the defect the restructure exists to remove.
 *
 * Returns a ref to attach and a flag that flips **once** and never back: a section already
 * paid for should not unmount when it scrolls off, or the user would pay again on the way back.
 */

import { useCallback, useEffect, useState } from 'react';

export interface MountOnIntersection<T extends HTMLElement> {
  /**
   * Attach to the section: `<section ref={gate.attach}>`.
   *
   * A callback ref rather than a ref object, for two reasons. The effect below then runs when
   * the element actually attaches instead of hoping it exists on the first pass, and a hook
   * returning a property named `ref` reads to the React compiler as a ref container, so every
   * consumer touching `gate.visible` during render was flagged.
   */
  attach: (node: T | null) => void;
  /** True from the first time the element came within `rootMargin` of the viewport. */
  visible: boolean;
  /** Mount it now regardless — for an explicit "build this" button. */
  reveal: () => void;
}

export function useMountOnIntersection<T extends HTMLElement = HTMLDivElement>(
  /** How early to arm, so the panel is ready by the time it is actually read. */
  rootMargin = '300px'
): MountOnIntersection<T> {
  const [element, setElement] = useState<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !element) return;

    // No IntersectionObserver — an old browser, or jsdom in a test. Mount rather than hide the
    // section forever: a missing optimisation is better than a missing panel.
    //
    // Deferred to a timer rather than set here directly, for two reasons: the initial state
    // cannot read `IntersectionObserver` without risking a hydration mismatch (the server has
    // none, a modern client does), and a synchronous setState in an effect body is the
    // cascading render the project's lint rule rightly refuses.
    if (typeof IntersectionObserver === 'undefined') {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, visible, rootMargin]);

  const reveal = useCallback(() => setVisible(true), []);

  return { attach: setElement, visible, reveal };
}
