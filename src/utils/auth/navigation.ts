/**
 * Full-page navigation, as a seam.
 *
 * After any change of session the page must be reloaded, not routed (the root
 * layout picks its shell on the server). Tests cannot observe
 * `window.location.assign` in jsdom — it can be neither stubbed nor followed —
 * so callers go through this function and tests mock it.
 */
export function navigate(url: string): void {
  window.location.assign(url);
}
