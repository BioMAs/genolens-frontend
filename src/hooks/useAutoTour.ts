'use client';

import { useEffect, useRef } from 'react';
import { useTour } from '@/contexts/TourContext';
import { getTour, type TourId } from '@/lib/tours/registry';
import { hasSeenTour, markTourSeen } from '@/lib/tours/storage';

const MAX_FRAMES = 60; // ~1s at 60fps before giving up

/**
 * Auto-launches the given tour the first time (per version) its page is
 * visited, once the first anchored element is present in the DOM.
 * Silent no-op if already seen or if anchors never appear.
 */
export function useAutoTour(id: TourId): void {
  const { startTour } = useTour();
  const startedRef = useRef(false);

  useEffect(() => {
    const tour = getTour(id);
    if (!tour || startedRef.current) return;
    if (hasSeenTour(id, tour.version)) return;

    const firstAnchored = tour.steps.find(
      (s) => typeof s.element === 'string',
    );
    const selector =
      typeof firstAnchored?.element === 'string' ? firstAnchored.element : null;

    let frames = 0;
    let raf = 0;
    const tick = () => {
      if (startedRef.current) return;
      const ready = selector ? document.querySelector(selector) : true;
      if (ready) {
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
