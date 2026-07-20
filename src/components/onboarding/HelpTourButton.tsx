'use client';

import { HelpCircle } from 'lucide-react';
import { useTour } from '@/contexts/TourContext';

/**
 * TopBar control that replays the onboarding tour for the current page.
 * Hidden on routes that have no tour.
 */
export default function HelpTourButton() {
  const { restartCurrentTour, currentTourId } = useTour();
  if (!currentTourId) return null;
  return (
    <button
      type="button"
      data-tour="help-button"
      onClick={restartCurrentTour}
      aria-label="Replay the guide"
      title="Replay the guide"
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover,rgba(0,0,0,0.05))] hover:text-[var(--text-primary)]"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}
