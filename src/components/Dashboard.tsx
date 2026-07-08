'use client';

import { useState } from 'react';
import ProjectList from './ProjectList';
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
import { useQuery } from '@tanstack/react-query';
import api from '@/utils/api';
import { UserProfile } from '@/types';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { user } = useCurrentUser();
  const { data: projectsData } = useProjects({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' });
  const projects = projectsData?.items ?? [];

  const { aggregated, statsMap, isLoading: statsLoading } = useUserDashboardStats(projects);

  const { data: subscription, isLoading: subLoading } = useSubscription();

  // Derive project limit state from subscription data
  const isAtProjectLimit =
    subscription?.max_projects != null &&
    (subscription?.project_count ?? 0) >= subscription.max_projects;

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const res = await api.get<UserProfile>('/users/me');
      return res.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const recentProject = [...projects]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  const aiInterpretationsUsed =
    subscription?.ai_interpretations_used ?? userProfile?.ai_interpretations_used ?? 0;

  return (
    <>
      <DashboardWelcomeBanner
        userName={user?.name ?? user?.email}
        recentProjectName={recentProject?.name}
        totalComparisons={aggregated.total_comparisons}
        activityLast7Days={aggregated.activity_last_7_days}
        aiInterpretationsUsed={aiInterpretationsUsed}
        resumeHref={recentProject ? `/projects/${recentProject.id}` : undefined}
      />

      {/* Jump back in — last result with its skin verdict (redesign 2a) */}
      {recentProject && (
        <div className="mb-6">
          <JumpBackInCard projectId={recentProject.id} />
        </div>
      )}

      {/* Global KPI bar */}
      <DashboardKpiBar stats={aggregated} isLoading={statsLoading && projects.length === 0} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-8">
        <div className="lg:col-span-8">
          <h3
            className="font-display text-sm font-semibold mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            Recent projects
          </h3>
          <RecentProjectsSection
            projects={projects}
            statsMap={statsMap}
            statsLoading={statsLoading}
            onCreateClick={() => setIsModalOpen(true)}
          />
        </div>

        <div className="lg:col-span-4">
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

      {/* Divider */}
      <div
        className="mb-6"
        style={{ borderTop: '1px solid var(--border-subtle)' }}
      />

      {/* All Projects */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2
          className="font-display font-bold tracking-tight"
          style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}
        >
          All Projects
        </h2>
        <button
          onClick={() => !isAtProjectLimit && setIsModalOpen(true)}
          disabled={isAtProjectLimit}
          title={isAtProjectLimit ? `Project limit reached (${subscription?.project_count}/${subscription?.max_projects}). Upgrade your plan.` : undefined}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'var(--sl-purple)' }}
          onMouseEnter={(e) => {
            if (!isAtProjectLimit) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple-dark)';
          }}
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = 'var(--sl-purple)')
          }
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      <ProjectList onCreateClick={() => setIsModalOpen(true)} />

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Cache invalidation happens inside CreateProjectModal via React Query
        }}
      />
    </>
  );
}
