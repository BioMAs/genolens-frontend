'use client';

import { useState } from 'react';
import Link from 'next/link';
import CreateProjectModal from './CreateProjectModal';
import DashboardWelcomeBanner from './DashboardWelcomeBanner';
import DashboardSubscriptionCard from './DashboardSubscriptionCard';
import RecentProjectsSection from './RecentProjectsSection';
import JumpBackInCard from './dashboard/JumpBackInCard';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjects } from '@/hooks/useProjects';
import { useUserDashboardStats } from '@/hooks/useUserDashboardStats';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useProjectLimit } from '@/hooks/useQuotas';
import QuotaMeters from './QuotaMeters';
import { useAutoTour } from '@/hooks/useAutoTour';

/**
 * Le dashboard, en deux bandes au lieu de cinq.
 *
 * Il en empilait cinq sur toute la largeur avant qu'on atteigne un projet :
 * bandeau, reprise, trois jauges de quota, trois pastilles de KPI, puis la
 * grille — environ 500px de « voici votre compte » avant « voici votre
 * travail ». Les trois rangees de metriques portaient en plus trois formes de
 * carte differentes, collees les unes aux autres.
 *
 *   1. En-tete + reprise — ou en etais-je, et qu'est-ce que je fais maintenant
 *   2. Grille — mes projets d'un cote, mon plan et mes quotas de l'autre
 *
 * La barre de KPI est absorbee par le sous-titre de l'en-tete. Les jauges de
 * quota rejoignent la carte d'abonnement : c'est litteralement le meme sujet,
 * la carte dit le plan et les jauges disent ce qu'il en reste, et elles
 * vivaient dans deux rangees ET deux colonnes differentes.
 */
export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  useAutoTour('dashboard');

  const { user } = useCurrentUser();
  const { data: projectsData } = useProjects({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' });
  const projects = projectsData?.items ?? [];

  const { aggregated, statsMap, isLoading: statsLoading } = useUserDashboardStats(projects);

  const { data: subscription, isLoading: subLoading } = useSubscription();

  // La barriere vit dans useProjectLimit, partagee avec /projects. Les deux
  // ecrans en portaient une copie mot pour mot, lisant `max_projects` sur la
  // charge utile d'abonnement — un champ qu'elle ne contient pas, donc une
  // comparaison qui portait toujours sur `undefined` et ne bloquait personne.
  const projectLimit = useProjectLimit();

  // `useUserProfile` remplace un useQuery inline sur la cle ['user-profile'] :
  // le meme endpoint sous une seconde identite de cache, donc un second appel
  // et deux verites possibles a l'ecran.
  const { data: userProfile } = useUserProfile();

  const recentProject = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  return (
    <>
      {/* ── Bande 1 — ou en etais-je ─────────────────────────────────────── */}
      <div data-tour="dashboard-welcome">
        <DashboardWelcomeBanner
          userName={user?.name ?? user?.email}
          recentProjectName={recentProject?.name}
          resumeHref={recentProject ? `/projects/${recentProject.id}` : undefined}
          stats={aggregated}
          statsLoading={statsLoading && projects.length === 0}
        />
      </div>

      {recentProject && (
        <div className="mb-8">
          <JumpBackInCard projectId={recentProject.id} />
        </div>
      )}

      {/* ── Bande 2 — mon travail, et ce qu'il me reste pour en faire ────── */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-title text-primary">Recent projects</h2>
            <div className="flex items-center gap-3">
              <Link href="/projects" className="text-caption font-medium text-accent-ink hover:underline">
                View all →
              </Link>
              {/* Le survol etait implemente en JavaScript : deux handlers
                  mutaient style.background, parce qu'un `style` inline bat un
                  `hover:`. La primitive rend les deux inutiles. */}
              <Button
                data-tour="dashboard-new-project"
                size="sm"
                onClick={() => !projectLimit.blocked && setIsModalOpen(true)}
                disabled={projectLimit.blocked}
                title={projectLimit.reason}
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </Button>
            </div>
          </div>
          <RecentProjectsSection
            projects={projects}
            statsMap={statsMap}
            statsLoading={statsLoading}
            onCreateClick={() => setIsModalOpen(true)}
          />
        </div>

        <div className="lg:col-span-4" data-tour="dashboard-plan">
          <h2 className="mb-3 text-title text-primary">My plan</h2>
          <div className="space-y-4">
            <DashboardSubscriptionCard
              subscription={subscription}
              userProfile={userProfile}
              isLoading={subLoading}
            />
            <QuotaMeters layout="column" />
          </div>
        </div>
      </div>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
