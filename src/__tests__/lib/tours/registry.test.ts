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

  it('anchors the dashboard navigation step on the top bar, not the removed sidebar', () => {
    const elements = TOURS.dashboard.steps.map((s) => s.element);
    expect(elements).toContain('[data-tour="nav-workspace"]');
    expect(elements).not.toContain('[data-tour="sidebar-workspace"]');
  });

  it('anchors the project tour on the project tabs, not the removed sidebar', () => {
    const elements = TOURS['project-overview'].steps.map((s) => s.element);
    expect(elements).toContain('[data-tour="nav-project"]');
    expect(elements).not.toContain('[data-tour="sidebar-project"]');
  });

  it('opens the bubbles of the navigation bars downward and no longer speaks of a side menu', () => {
    for (const anchorKey of ['nav-workspace', 'nav-project']) {
      const steps = Object.values(TOURS)
        .flatMap((t) => t.steps)
        .filter((s) => s.element === `[data-tour="${anchorKey}"]`);
      // Garde du garde-fou : sans etape lue, la boucle ne verifierait rien.
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) {
        // Les barres sont en haut : une bulle a droite serait hors de l'ecran.
        expect(step.popover?.side).toBe('bottom');
        expect(step.popover?.description).not.toMatch(/side ?menu|sidebar/i);
      }
    }
  });

  it('describes the help step as the Help menu, not as a replay button', () => {
    const help = TOURS.dashboard.steps.find((s) => s.element === '[data-tour="help-button"]');
    expect(help).toBeDefined();
    expect(help?.popover?.title).toBe('Help');
    expect(help?.popover?.description).toMatch(/menu/i);
    expect(help?.popover?.description).toMatch(/guide/i);
    expect(help?.popover?.description).toMatch(/documentation/i);
    expect(help?.popover?.description).not.toMatch(/this button/i);
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
