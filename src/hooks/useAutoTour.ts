'use client';

import { useEffect, useRef } from 'react';
import { useTour } from '@/contexts/TourContext';
import { isTourReady } from '@/lib/tours/anchors';
import { getTour, type TourId } from '@/lib/tours/registry';
import { hasSeenTour, markTourSeen } from '@/lib/tours/storage';

const MAX_FRAMES = 60; // ~1s at 60fps before giving up

/**
 * Auto-launches the given tour the first time (per version) its page is
 * visited, once its first VISIBLE anchored step is present in the DOM. An anchor
 * that exists but has no layout box (the desktop bar below 60rem) does not count:
 * the tour waits for the next one instead of opening on a bubble in the corner.
 * Silent no-op if already seen or if no anchor ever becomes visible.
 */
export function useAutoTour(id: TourId): void {
  const { startTour } = useTour();
  const startedRef = useRef(false);

  useEffect(() => {
    const tour = getTour(id);
    if (!tour || startedRef.current) return;
    if (hasSeenTour(id, tour.version)) return;

    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (startedRef.current) return;
      if (isTourReady(tour.steps)) {
        startedRef.current = true;
        markTourSeen(id, tour.version);
        startTour(id);
        return;
      }
      if (frames++ < MAX_FRAMES) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(raf);
  }, [id, startTour]);
}
