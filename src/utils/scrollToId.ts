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
 * Sections set `scroll-mt-*` for the sticky header; `scrollIntoView` honours `scroll-margin-top`,
 * so no offset arithmetic is needed here.
 */
export function scrollToId(id: string): boolean {
  if (typeof window === 'undefined') return false;

  const element = document.getElementById(id);
  if (!element) return false;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  return true;
}
