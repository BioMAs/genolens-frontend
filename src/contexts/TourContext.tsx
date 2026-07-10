// src/contexts/TourContext.tsx
'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { usePathname } from 'next/navigation';
import 'driver.js/dist/driver.css';
import '@/styles/driver-theme.css';
import { useTheme } from '@/contexts/ThemeContext';
import { getTour, tourIdForPathname, type TourId } from '@/lib/tours/registry';

interface TourContextValue {
  startTour: (id: TourId) => void;
  restartCurrentTour: () => void;
  currentTourId: TourId | null;
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const currentTourId = tourIdForPathname(pathname ?? '');

  const startTour = useCallback(
    async (id: TourId) => {
      const tour = getTour(id);
      try {
        const { driver } = await import('driver.js');
        const popoverClass =
          theme === 'dark' ? 'genolens-tour genolens-tour-dark' : 'genolens-tour';
        const driverObj = driver({
          showProgress: true,
          allowClose: true,
          nextBtnText: 'Suivant',
          prevBtnText: 'Précédent',
          doneBtnText: 'Terminer',
          progressText: '{{current}} / {{total}}',
          popoverClass,
          steps: tour.steps,
        });
        driverObj.drive();
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[tour] failed to start', err);
        }
      }
    },
    [theme],
  );

  const restartCurrentTour = useCallback(() => {
    if (currentTourId) startTour(currentTourId);
  }, [currentTourId, startTour]);

  return (
    <TourContext.Provider value={{ startTour, restartCurrentTour, currentTourId }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (ctx === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return ctx;
}
