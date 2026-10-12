'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CreateProjectModal from './CreateProjectModal';
import DashboardSubscriptionCard from './DashboardSubscriptionCard';
import RecentProjectsSection from './RecentProjectsSection';
import JumpBackInCard from './dashboard/JumpBackInCard';
import DashboardHero from './dashboard/DashboardHero';
import AccountFigures from './dashboard/AccountFigures';
import LatestResults from './dashboard/LatestResults';
import QuickActions from './dashboard/QuickActions';
import ActivityFeed from './dashboard/ActivityFeed';
import { comparisonTitle } from './dashboard/format';
import type { HelixItem } from './dashboard/helix/DataHelix';
import { FlaskConical, Plus } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjects } from '@/hooks/useProjects';
import { useUserDashboardStats } from '@/hooks/useUserDashboardStats';
import { useSubscription } from '@/hooks/useSubscription';
import { useUserProfile } from '@/hooks/useUserProfile';
import { useProjectLimit } from '@/hooks/useQuotas';
import { useAllComparisons } from '@/hooks/useAllComparisons';
import { useWorkspaceActivity } from '@/hooks/useWorkspaceActivity';
import QuotaMeters from './QuotaMeters';
import { useAutoTour } from '@/hooks/useAutoTour';

/**
 * Le dashboard : « ou en est mon travail », avant « ou en est mon compte ».
 *
 * La version precedente tenait en deux bandes — un en-tete d'une ligne et une
 * grille de trois projets — et l'ecran s'ouvrait sur du vide. Celle-ci garde
 * la meme regle d'ordre (le travail d'abord) mais remplit chaque etage avec
 * des donnees reelles :
 *
 *   1. En-tete — salutation, reprise, et l'helice de donnees : une paire de
 *      bases par comparaison, coloree par sa part de genes up / down.
 *   2. Chiffres du compte — une bande reglee, lue comme le pipeline.
 *   3. Grille — a gauche le travail (derniers resultats, projets), a droite
 *      les gestes et le contexte (actions rapides, activite).
 *   4. Le compte — le plan et ses jauges, en bande pleine largeur.
 *
 * L'helice et la liste des derniers resultats partagent un etat de survol :
 * survoler une ligne fait tourner l'helice jusqu'a la paire correspondante,
 * survoler une paire surligne sa ligne.
 *
 * La carte « Jump back in » ne reste que pour les comptes dotes du module
 * peau : elle y apporte une lecture (couches cutanees, verdict) que la liste
 * n'a pas. Sans ce module, elle repetait la premiere ligne des resultats.
 */

const HELIX_DEPTH = 24;

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  useAutoTour('dashboard');

  const { user } = useCurrentUser();
  const { data: projectsData } = useProjects({ page_size: 100, sort_by: 'updated_at', sort_order: 'desc' });
  const projects = useMemo(() => projectsData?.items ?? [], [projectsData]);

  const { aggregated, statsMap, isLoading: statsLoading } = useUserDashboardStats(projects);
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const projectLimit = useProjectLimit();
  const { data: userProfile } = useUserProfile();

  // Une seule requete nourrit l'helice ET la liste : les 24 comparaisons les
  // plus recentes, la liste n'en montrant que les 5 premieres.
  const { data: comparisonsData, isLoading: comparisonsLoading, isError: comparisonsError } =
    useAllComparisons({ page_size: HELIX_DEPTH, sort_by: 'updated_at', sort_order: 'desc' });
  const comparisons = useMemo(() => comparisonsData?.comparisons ?? [], [comparisonsData]);

  const helixItems: HelixItem[] = useMemo(
    () =>
      comparisons.map((c) => ({
        ...c,
        title: comparisonTitle(c.name),
        href: `/projects/${c.project_id}/comparisons/${encodeURIComponent(c.name)}`,
      })),
    [comparisons],
  );

  const activity = useWorkspaceActivity(projects);

  const recentProject = [...projects].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0];

  const showSkinRead = !!recentProject && userProfile?.has_cosmetics_module === true;

  return (
    <>
      {/* ── 1. En-tete et helice ─────────────────────────────────────────── */}
      <DashboardHero
        userName={user?.name ?? user?.email}
        recentProjectName={recentProject?.name}
        resumeHref={recentProject ? `/projects/${recentProject.id}` : undefined}
        helixItems={helixItems}
        helixReady={!comparisonsLoading || comparisonsError}
        activeKey={activeKey}
        onActiveKeyChange={setActiveKey}
      />

      {/* ── 2. Chiffres du compte ────────────────────────────────────────── */}
      <div className="mb-12">
        <AccountFigures stats={aggregated} loading={statsLoading} />
      </div>

      {showSkinRead && (
        <div className="mb-12">
          <JumpBackInCard projectId={recentProject.id} />
        </div>
      )}

      {/* ── 3. Le travail a gauche, les gestes et le contexte a droite ─────
          Deux RANGEES appariees plutot que deux colonnes libres : en colonnes,
          la droite (actions, activite, plan, trois jauges) faisait le double
          de la gauche et rouvrait un grand vide sous les projets. Ici chaque
          bloc de gauche a un voisin de hauteur comparable, et l'ordre mobile
          reste celui de la lecture : resultats, gestes, projets, activite. */}
      <div className="mb-12 grid grid-cols-1 items-start gap-x-8 gap-y-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <LatestResults
            items={comparisons.slice(0, 5)}
            loading={comparisonsLoading}
            activeKey={activeKey}
            onActiveKeyChange={setActiveKey}
            emptyAction={
              recentProject ? (
                <Link
                  href={`/projects/${recentProject.id}/analyses/new`}
                  className={buttonClasses({ variant: 'outline', size: 'sm', className: 'shrink-0' })}
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Start an analysis
                </Link>
              ) : undefined
            }
          />
        </div>

        <div className="min-w-0 lg:col-span-4">
          <QuickActions
            project={recentProject ? { id: recentProject.id, name: recentProject.name } : undefined}
            latest={comparisons[0]}
          />
        </div>

        <div className="min-w-0 lg:col-span-8">
          <section aria-labelledby="recent-projects-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="recent-projects-title" className="text-title text-primary">
                Recent projects
              </h2>
              <div className="flex items-center gap-3">
                <Link href="/projects" className="text-caption font-medium text-accent-ink hover:underline">
                  View all →
                </Link>
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
          </section>
        </div>

        <div className="min-w-0 lg:col-span-4">
          <ActivityFeed items={activity.items} loading={activity.isLoading} currentUserId={user?.id} />
        </div>
      </div>

      {/* ── 4. Le compte, en dernier ─────────────────────────────────────────
          Le plan et ce qu'il en reste : une bande pleine largeur. La carte dit
          le plan, les jauges disent le reste — meme sujet, meme rangee. */}
      <section data-tour="dashboard-plan" aria-labelledby="plan-title" className="mb-8">
        <h2 id="plan-title" className="mb-3 text-title text-primary">
          My plan
        </h2>
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <DashboardSubscriptionCard
            subscription={subscription}
            userProfile={userProfile}
            isLoading={subLoading}
          />
          <QuotaMeters layout="row" />
        </div>
      </section>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
