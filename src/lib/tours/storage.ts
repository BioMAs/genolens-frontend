/**
 * Per-tour "already seen" persistence, backed by localStorage.
 * Keys are versioned so bumping a tour's version re-triggers it.
 * All access is wrapped in try/catch: in strict-privacy browsers where
 * localStorage throws, we degrade to "not seen" and never crash.
 */
export function tourStorageKey(id: string, version: number): string {
  return `genolens.tour.${id}.v${version}`;
}

export function hasSeenTour(id: string, version: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(tourStorageKey(id, version)) === '1';
  } catch {
    return false;
  }
}

export function markTourSeen(id: string, version: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(tourStorageKey(id, version), '1');
  } catch {
    /* ignore write failures (private mode) */
  }
}

export function clearTourSeen(id: string, version: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(tourStorageKey(id, version));
  } catch {
    /* ignore */
  }
}
