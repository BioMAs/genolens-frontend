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
          title: 'Bienvenue sur GenoLens 👋',
          description:
            "Ce guide rapide vous montre l'essentiel. Vous pourrez le relancer à tout moment.",
        },
      },
      {
        element: anchor('sidebar-workspace'),
        popover: {
          title: 'Navigation',
          description:
            'Accédez au tableau de bord et aux outils depuis ce menu latéral.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-welcome'),
        popover: {
          title: 'Votre activité',
          description:
            'Un résumé de vos projets récents et de votre activité apparaît ici.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-kpis'),
        popover: {
          title: 'Indicateurs clés',
          description: 'Vos comparaisons, analyses et usages en un coup d\'œil.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-plan'),
        popover: {
          title: 'Votre abonnement',
          description: 'Suivez vos quotas et votre offre depuis cette carte.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: anchor('dashboard-new-project'),
        popover: {
          title: 'Créer un projet',
          description:
            'Lancez-vous : créez un projet pour importer vos données et démarrer une analyse.',
          side: 'left',
          align: 'end',
        },
      },
      {
        element: anchor('help-button'),
        popover: {
          title: 'Rejouer le guide',
          description:
            'Ce bouton relance le guide de la page où vous vous trouvez.',
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
          title: 'Sections du projet',
          description:
            'Naviguez entre l\'aperçu, la configuration, les analyses et la multi-comparaison.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: anchor('project-overview'),
        popover: {
          title: 'Aperçu du projet',
          description:
            'Retrouvez ici vos jeux de données, analyses et l\'activité du projet.',
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
          title: 'Vos analyses',
          description:
            'La liste de vos analyses en libre-service, avec leur statut, s\'affiche ici.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: anchor('analyses-new'),
        popover: {
          title: 'Nouvelle analyse',
          description: 'Lancez une nouvelle analyse depuis ce bouton.',
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
