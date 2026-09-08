'use client';

import { useState } from 'react';
import Link from 'next/link';
import CreateProjectModal from './CreateProjectModal';
import DashboardWelcomeBanner from './DashboardWelcomeBanner';
import DashboardKpiBar from './DashboardKpiBar';
import DashboardSubscriptionCard from './DashboardSubscriptionCard';
import RecentProjectsSection from './RecentProjectsSection';
import JumpBackInCard from './dashboard/JumpBackInCard';
import { Plus } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjects } from '@/hooks/useProjects';
import { useUserDashboardStats } from '@/hooks/useUserDashboardStats';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useProjectLimit } from '@/hooks/useQuotas';
import QuotaMeters from './QuotaMeters';
import { useAutoTour } from '@/hooks/useAutoTour';

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
      <div data-tour="dashboard-welcome">
        <DashboardWelcomeBanner
          userName={user?.name ?? user?.email}
          recentProjectName={recentProject?.name}
          resumeHref={recentProject ? `/projects/${recentProject.id}` : undefined}
        />
      </div>

      {/* Jump back in — last result with its skin verdict (redesign 2a) */}
      {recentProject && (
        <div className="mb-6">
          <JumpBackInCard projectId={recentProject.id} />
        </div>
      )}

      {/* Rangee 3 — qu'est-ce qu'il me reste */}
      <div className="mb-6">
        <QuotaMeters layout="row" />
      </div>

      {/* Rangee 4 — qu'est-ce que j'ai produit */}
      <div data-tour="dashboard-kpis">
        <DashboardKpiBar stats={aggregated} isLoading={statsLoading && projects.length === 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        <div className="lg:col-span-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3
              className="font-display text-sm font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              Recent projects
            </h3>
            <div className="flex items-center gap-2">
              <Link
                href="/projects"
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--sl-purple)' }}
              >
                View all →
              </Link>
              <button
                data-tour="dashboard-new-project"
                onClick={() => !projectLimit.blocked && setIsModalOpen(true)}
                disabled={projectLimit.blocked}
                title={projectLimit.reason}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--sl-purple)' }}
                onMouseEnter={(e) => {
                  if (!projectLimit.blocked) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)';
                }}
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
                }
              >
                <Plus className="h-3.5 w-3.5" />
                New Project
              </button>
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
          <h3
            className="font-display text-sm font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            My plan
          </h3>
          <DashboardSubscriptionCard
            subscription={subscription}
            userProfile={userProfile}
            isLoading={subLoading}
          />
        </div>
      </div>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
