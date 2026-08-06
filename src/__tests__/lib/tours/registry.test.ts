import { TOURS, getTour, tourIdForPathname } from '@/lib/tours/registry';

describe('tour registry', () => {
  it('every tour has a positive version and at least one step', () => {
    for (const tour of Object.values(TOURS)) {
      expect(tour.version).toBeGreaterThan(0);
      expect(tour.steps.length).toBeGreaterThan(0);
    }
  });

  it('element-anchored steps use a data-tour selector', () => {
    for (const tour of Object.values(TOURS)) {
      for (const step of tour.steps) {
        if (typeof step.element === 'string') {
          expect(step.element).toMatch(/^\[data-tour="[a-z-]+"\]$/);
        }
      }
    }
  });

  it('getTour returns the matching definition', () => {
    expect(getTour('dashboard').id).toBe('dashboard');
  });

  it('maps pathnames to tour ids', () => {
    expect(tourIdForPathname('/dashboard')).toBe('dashboard');
    expect(tourIdForPathname('/projects/abc')).toBe('project-overview');
    expect(tourIdForPathname('/projects/abc/analyses')).toBe('analyses');
    expect(tourIdForPathname('/projects/abc/setup')).toBeNull();
    expect(tourIdForPathname('/login')).toBeNull();
  });
});
