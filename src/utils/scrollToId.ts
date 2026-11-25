/**
 * Scroll an anchored section into view, honouring `prefers-reduced-motion`.
 *
 * Exists because `history.replaceState` writes a hash without ever scrolling — the browser only
 * jumps to an anchor on a real navigation. So a plain `<a href="#genes">` moves the page while
 * every button that set the same hash through `replaceState` silently did not.
 *
 * Returns false when no element carries that id, which is the caller's cue that the target has
 * not mounted yet — switching screens renders it one pass later.
 *
 * Sections set `scroll-margin-top: calc(var(--sticky-top) + 1rem)` for the sticky top bar;
 * `scrollIntoView` honours it, so no offset arithmetic is needed here. A literal `scroll-mt-6`
 * would land the target behind the 64px bar (shell.test.ts refuses it).
 */
export function scrollToId(id: string): boolean {
  if (typeof window === 'undefined') return false;

  const element = document.getElementById(id);
  if (!element) return false;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return true;
}
