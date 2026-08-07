// Guards that the dashboard tour's anchor keys exist as data-tour attributes
// in the registry, so steps never point at missing targets.
import { TOURS } from '@/lib/tours/registry';

describe('dashboard tour anchors', () => {
  it('references only the keys we render in Dashboard/Sidebar', () => {
    const rendered = new Set([
      'sidebar-workspace',
      'dashboard-welcome',
      'dashboard-kpis',
      'dashboard-plan',
      'dashboard-new-project',
      'help-button',
    ]);
    for (const step of TOURS.dashboard.steps) {
      if (typeof step.element === 'string') {
        const key = step.element.replace(/^\[data-tour="|"\]$/g, '');
        expect(rendered.has(key)).toBe(true);
      }
    }
  });
});
