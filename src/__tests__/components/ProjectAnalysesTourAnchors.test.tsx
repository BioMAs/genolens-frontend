import { TOURS } from '@/lib/tours/registry';

describe('project & analyses tour anchors', () => {
  const rendered = new Set([
    'sidebar-project',
    'project-overview',
    'analyses-list',
    'analyses-new',
  ]);

  it('project-overview steps reference rendered keys', () => {
    for (const step of TOURS['project-overview'].steps) {
      if (typeof step.element === 'string') {
        const key = step.element.replace(/^\[data-tour="|"\]$/g, '');
        expect(rendered.has(key)).toBe(true);
      }
    }
  });

  it('analyses steps reference rendered keys', () => {
    for (const step of TOURS.analyses.steps) {
      if (typeof step.element === 'string') {
        const key = step.element.replace(/^\[data-tour="|"\]$/g, '');
        expect(rendered.has(key)).toBe(true);
      }
    }
  });
});
