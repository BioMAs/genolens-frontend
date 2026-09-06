import type { DriveStep } from 'driver.js';

export type TourId = 'dashboard' | 'project-overview' | 'analyses';

export interface TourDefinition {
  id: TourId;
  version: number;
  steps: DriveStep[];
}

const anchor = (key: string) => `[data-tour="${key}"]`;

export const TOURS: Record<TourId, TourDefinition> = {
  dashboard: {
    id: 'dashboard',
    version: 1,
    steps: [
      {
        popover: {
          title: 'Welcome to GenoLens 👋',
          description:
            'This quick guide walks you through the essentials. You can replay it anytime.',
        },
      },
      {
        element: anchor('sidebar-workspace'),
        popover: {
          title: 'Navigation',
          description:
            'Reach your dashboard, projects, comparisons and tools from this side menu.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-welcome'),
        popover: {
          title: 'Your activity',
          description:
            'A summary of your recent projects and activity appears here.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-kpis'),
        popover: {
          title: 'Key metrics',
          description: 'Your comparisons, analyses and usage at a glance.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-plan'),
        popover: {
          title: 'Your plan',
          description: 'Track your quotas and subscription from this card.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-new-project'),
        popover: {
          title: 'Create a project',
          description:
            'Get started: create a project to import your data and run an analysis.',
          side: 'left',
          align: 'end',
        },
      },
      {
        element: anchor('help-button'),
        popover: {
          title: 'Replay the guide',
          description:
            'This button restarts the guide for the page you are on.',
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  },
  'project-overview': {
    id: 'project-overview',
    version: 1,
    steps: [
      {
        element: anchor('sidebar-project'),
        popover: {
          title: 'Project sections',
          description:
            'Move between the overview, setup, analyses and multi-comparison.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: anchor('project-overview'),
        popover: {
          title: 'Project overview',
          description:
            'Find your datasets, analyses and project activity here.',
          side: 'top',
          align: 'start',
        },
      },
    ],
  },
  analyses: {
    id: 'analyses',
    version: 1,
    steps: [
      {
        element: anchor('analyses-list'),
        popover: {
          title: 'Your analyses',
          description:
            'Your self-service analyses and their status are listed here.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: anchor('analyses-new'),
        popover: {
          title: 'New analysis',
          description: 'Launch a new analysis from this button.',
          side: 'left',
          align: 'start',
        },
      },
    ],
  },
};

export function getTour(id: TourId): TourDefinition {
  return TOURS[id];
}

/**
 * Resolve which tour (if any) owns a given route.
 * Order matters: check the deeper `/analyses` route before the
 * generic project-overview route.
 */
export function tourIdForPathname(pathname: string): TourId | null {
  if (pathname === '/dashboard') return 'dashboard';
  if (/^\/projects\/[^/]+\/analyses\/?$/.test(pathname)) return 'analyses';
  if (/^\/projects\/[^/]+\/?$/.test(pathname)) return 'project-overview';
  return null;
}
