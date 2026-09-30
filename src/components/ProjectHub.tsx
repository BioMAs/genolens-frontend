'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useProjectSummary, useProjectDatasets } from '@/hooks/useProjectData';
import { useAnalyses } from '@/hooks/useAnalyses';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useProjectPermissions } from '@/hooks/useProjectPermissions';
import { DatasetStatus, DatasetType, SelfServiceAnalysisStatus, Dataset } from '@/types';
import BookmarkManager from '@/components/BookmarkManager';
import GeneListManager from '@/components/GeneListManager';
import CustomGeneSetManager from '@/components/CustomGeneSetManager';
import { buttonClasses } from '@/components/ui/button';
import { type MenuItem } from '@/components/ui/menu';
import { SegmentedControl, type SegmentItem } from '@/components/ui/tabs';
import { PageShell } from '@/components/ui/page-shell';
import { PageHeader } from '@/components/ui/page-header';
import ProjectMembersModal from '@/components/ProjectMembersModal';
import ProjectHistory from '@/components/ProjectHistory';
import { ProjectDetailSkeleton } from '@/components/Skeletons';
import { useAutoTour } from '@/hooks/useAutoTour';
import { StatChip } from '@/components/ui/stat-chip';
import { Dot } from '@/components/ui/dot';
import { Chip } from '@/components/ui/chip';
import { Dialog } from '@/components/ui/dialog';
import { EmptyStateHelix } from '@/components/ui/empty-state-helix';
import {
  Plus,
  Upload,
  Users,
  Star,
  List,
  GitCompare,
  GitCompareArrows,
  Database,
  FlaskConical,
  Clock,
  ArrowRight,
  Layers,
  Activity,
  BarChart3,
} from 'lucide-react';
import AnalysisStatusCard from '@/components/analyses/AnalysisStatusCard';
import { useScientificModule } from '@/hooks/useAddOnModules';

const SCIENCE_LOCKED_HINT = 'Scientific tools add-on — ask an admin to enable it';

interface ProjectHubProps {
  projectId: string;
}

type ProjectTab = 'analyses' | 'comparisons' | 'datasets' | 'history';

const PROJECT_TABS: SegmentItem<ProjectTab>[] = [
  { value: 'analyses', label: 'Analyses' },
  { value: 'comparisons', label: 'Comparisons' },
  { value: 'datasets', label: 'Datasets' },
  { value: 'history', label: 'History' },
];

export default function ProjectHub({ projectId }: ProjectHubProps) {
  useAutoTour('project-overview');
  const { unlocked: scienceUnlocked } = useScientificModule();
  const { user: currentUser } = useCurrentUser();
  const { data: summary, isLoading } = useProjectSummary(projectId);
  const { data: datasets = [] } = useProjectDatasets(projectId);
  const { data: analysesData } = useAnalyses(projectId);

  const [activeTab, setActiveTab] = useState<ProjectTab>('analyses');
  const [isBookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [isGeneListModalOpen, setGeneListModalOpen] = useState(false);
  const [isGeneSetModalOpen, setGeneSetModalOpen] = useState(false);
  const [isMembersModalOpen, setMembersModalOpen] = useState(false);

  const project = summary?.project;
  const stats = summary?.stats;
  const comparisons = summary?.comparisons ?? [];
  const analyses = analysesData?.items ?? [];

  // Build a map: dataset_id → analysisId, for linking comparisons through their analysis
  const datasetToAnalysisId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const analysis of analysesData?.items ?? []) {
      for (const datasetId of analysis.result_dataset_ids ?? []) {
        map[datasetId] = analysis.id;
      }
    }
    return map;
  }, [analysesData?.items]);

  const { isOwner, canManageData } = useProjectPermissions(projectId);

  const runningAnalyses = analyses.filter(
    (a) =>
      a.status === SelfServiceAnalysisStatus.PENDING ||
      a.status === SelfServiceAnalysisStatus.RUNNING,
  );

  const sourceDatasets = datasets.filter(
    (d) =>
      d.type === DatasetType.MATRIX ||
      d.type === DatasetType.METADATA_SAMPLE ||
      d.type === DatasetType.METADATA_CONTRAST,
  );

  const readyDataset = useMemo(
    () => sourceDatasets.find((d) => d.status === DatasetStatus.READY),
    [sourceDatasets],
  );

  if (isLoading) return <ProjectDetailSkeleton />;
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Project not found.</p>
      </div>
    );
  }

  // Le motif « fonctionnalite verrouillee » etait recopie mot pour mot a deux
  // endroits (un <span> desactive + <Lock/>). Represente ici comme une entree
  // de menu desactivee, ce qui est sa place : l'element reste visible, donc
  // decouvrable, et sa raison tient dans l'infobulle.
  const overflowActions: MenuItem[] = [
    ...(comparisons.length >= 2
      ? [{
          label: 'Contrast scatter',
          icon: <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />,
          href: `/projects/${projectId}/contrast-scatter`,
          locked: !scienceUnlocked,
          lockedHint: SCIENCE_LOCKED_HINT,
        }]
      : []),
    { label: 'Bookmarks', icon: <Star className="h-3.5 w-3.5 shrink-0" />, onSelect: () => setBookmarkModalOpen(true) },
    { label: 'Gene lists', icon: <List className="h-3.5 w-3.5 shrink-0" />, onSelect: () => setGeneListModalOpen(true) },
    {
      label: 'Custom gene sets',
      icon: <List className="h-3.5 w-3.5 shrink-0" />,
      onSelect: () => setGeneSetModalOpen(true),
      locked: !scienceUnlocked,
      lockedHint: SCIENCE_LOCKED_HINT,
    },
    ...(isOwner
      ? [{ label: 'Members', icon: <Users className="h-3.5 w-3.5 shrink-0" />, onSelect: () => setMembersModalOpen(true) }]
      : []),
  ];

  return (
    <PageShell measure="wide" data-tour="project-overview">
      <PageHeader
        // Enrichit le fil d'Ariane avec le vrai nom : la table de routes ne
        // connait que « Project », elle ne peut pas deviner « Skin Study ».
        crumbs={[{ label: 'Projects', href: '/projects' }, { label: project.name }]}
        title={project.name}
        titleVariant="name"
        description={project.description || undefined}
        meta={
          <>
            <StatChip icon={<GitCompare className="h-4 w-4" />} value={comparisons.length} label="Comparisons" />
            <StatChip icon={<Database className="h-4 w-4" />} value={stats?.total_datasets ?? 0} label="Datasets" />
            <StatChip icon={<FlaskConical className="h-4 w-4" />} value={analyses.length} label="Analyses" />
            <StatChip icon={<Upload className="h-4 w-4" />} value={stats?.original_files_count ?? 0} label="Original Files" />
          </>
        }
        // Deux actions visibles au plus ; le reste part au depassement, tenu
        // par la primitive et non par la revue.
        actions={[
          ...(canManageData
            ? [{
                node: (
                  <Link href={`/projects/${projectId}/setup`} className={buttonClasses({ size: 'sm' })}>
                    <Plus className="h-3.5 w-3.5" /> New analysis
                  </Link>
                ),
              }]
            : []),
          ...(comparisons.length >= 2
            ? [{
                node: (
                  <Link
                    href={`/projects/${projectId}/multi-comparison`}
                    className={buttonClasses({ variant: 'outline', size: 'sm' })}
                  >
                    <Layers className="h-3.5 w-3.5" /> Multi-comparison
                  </Link>
                ),
              }]
            : []),
        ]}
        menuItems={overflowActions}
        tabs={
          <SegmentedControl
            label="Project sections"
            items={PROJECT_TABS}
            value={activeTab}
            onValueChange={setActiveTab}
          />
        }
      />

      {activeTab === 'comparisons' ? (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8 space-y-3">
            {comparisons.length === 0 ? (
              <EmptyStateHelix
                title="No comparisons yet"
                description="Upload data and configure your first differential expression comparison."
                action={
                  <Link
                    href={`/projects/${projectId}/setup`}
                    className="inline-flex items-center gap-2 rounded-control px-4 py-1.5 text-caption font-semibold text-on-accent bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" /> Start Analysis
                  </Link>
                }
              />
            ) : (
              comparisons.map((comparison) => (
                <ComparisonCard
                  key={comparison.name}
                  projectId={projectId}
                  analysisId={datasetToAnalysisId[comparison.dataset_id]}
                  name={comparison.name}
                  up={comparison.deg_up}
                  down={comparison.deg_down}
                  hasEnrichment={comparison.has_enrichment}
                />
              ))
            )}

            {runningAnalyses.length > 0 ? (
              <div className="gl-card p-4">
                <div className="mb-2 flex items-center gap-2 text-body-sm font-semibold text-primary">
                  <Clock className="h-4 w-4" /> Processing
                </div>
                <div className="space-y-2">
                  {runningAnalyses.map((analysis) => (
                    <div key={analysis.id} className="flex items-center justify-between rounded-control px-3 py-2 bg-raised">
                      <span className="text-body-sm text-secondary">{analysis.name}</span>
                      <span className="inline-flex items-center gap-2 text-caption text-muted">
                        <Dot variant="processing" size={7} /> {analysis.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-4 space-y-3">
            <div className="gl-card p-4">
              <div className="mb-2 text-caption font-semibold uppercase text-muted tracking-[0.06em]">
                Add Data
              </div>
              <Link
                href={`/projects/${projectId}/setup`}
                className="flex flex-col items-center justify-center gap-2 rounded-control border border-dashed px-4 py-6 text-center border-line text-secondary"
              >
                <Upload className="h-5 w-5" />
                <span className="text-body-sm">Drop CSV / TSV / Excel or open setup wizard</span>
                <Chip>Counts matrix · DEG · metadata</Chip>
              </Link>
            </div>

            <DatasetListCard datasets={sourceDatasets} />

            {canManageData ? (
              <Link
                href={`/projects/${projectId}/setup`}
                className="inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-semibold text-on-accent bg-accent"
              >
                <Plus className="h-3.5 w-3.5" /> New Analysis
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === 'datasets' ? (
        <div className="mt-4 gl-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-body-sm font-semibold text-primary">
              Source datasets
            </h2>
            {canManageData ? (
              <Link
                href={`/projects/${projectId}/setup`}
                className="inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-semibold text-on-accent bg-accent"
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </Link>
            ) : null}
          </div>

          {sourceDatasets.length === 0 ? (
            <p className="text-body-sm text-muted">
              No source files uploaded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {sourceDatasets.map((dataset) => (
                <div key={dataset.id} className="flex items-center justify-between rounded-control px-3 py-2 bg-raised">
                  <div>
                    <p className="text-body-sm font-medium text-primary">{dataset.name}</p>
                    <p className="text-caption text-muted">{dataset.type}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-caption text-secondary">
                    <DatasetStatusDot status={dataset.status} /> {dataset.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'analyses' ? (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-body-sm font-semibold text-primary">
              Analyses ({analyses.length})
            </h2>
            {canManageData ? (
              <Link
                href={`/projects/${projectId}/setup`}
                className="inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-semibold text-on-accent bg-accent"
              >
                <Plus className="h-3.5 w-3.5" /> New Analysis
              </Link>
            ) : null}
          </div>
          {analyses.length === 0 ? (
            <EmptyStateHelix
              title="No analyses yet"
              description="Launch your first self-service analysis to run DESeq2, generate PCA and QC reports."
              action={
                canManageData ? (
                  <Link
                    href={`/projects/${projectId}/setup`}
                    className="inline-flex items-center gap-2 rounded-control px-4 py-1.5 text-caption font-semibold text-on-accent bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Analysis
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analyses.map((analysis) => (
                <AnalysisStatusCard key={analysis.id} analysis={analysis} projectId={projectId} />
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === 'history' ? (
        <div className="mt-4">
          <ProjectHistory projectId={projectId} />
        </div>
      ) : null}

      {isBookmarkModalOpen ? (
        <Dialog open onClose={() => setBookmarkModalOpen(false)} title="My Bookmarks" size="xl" className="h-[80dvh]">
          <BookmarkManager projectId={projectId} />
        </Dialog>
      ) : null}

      {isGeneListModalOpen ? (
        <Dialog open onClose={() => setGeneListModalOpen(false)} title="My Gene Lists" size="xl" className="h-[80dvh]">
          <GeneListManager projectId={projectId} />
        </Dialog>
      ) : null}

      {isGeneSetModalOpen && scienceUnlocked ? (
        <Dialog open onClose={() => setGeneSetModalOpen(false)} title="Custom gene sets" size="xl" className="h-[80dvh]">
          <CustomGeneSetManager projectId={projectId} />
        </Dialog>
      ) : null}

      {isMembersModalOpen && project && currentUser ? (
        <ProjectMembersModal
          projectId={projectId}
          projectOwnerId={project.owner_id}
          currentUserId={currentUser.id}
          isOpen={isMembersModalOpen}
          onClose={() => setMembersModalOpen(false)}
        />
      ) : null}
    </PageShell>
  );
}

function ComparisonCard({
  projectId,
  analysisId,
  name,
  up,
  down,
  hasEnrichment,
}: {
  projectId: string;
  analysisId?: string;
  name: string;
  up: number;
  down: number;
  hasEnrichment: boolean;
}) {
  const href = analysisId
    ? `/projects/${projectId}/analyses/${analysisId}/comparisons/${encodeURIComponent(name)}`
    : `/projects/${projectId}/comparisons/${encodeURIComponent(name)}`;
  return (
    <div className="gl-card gl-card-interactive flex items-center justify-between gap-4 p-4">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="font-display text-body-sm font-semibold text-primary">
            {name}
          </span>
          <Chip icon={<Activity className="h-3 w-3" />}>DEG</Chip>
          {hasEnrichment ? <Chip icon={<BarChart3 className="h-3 w-3" />}>GSEA</Chip> : null}
        </div>

        <div className="flex items-center gap-3 text-caption text-secondary">
          <span>
            {/* La carte disait « down = indigo » quand le nuage de volcan, un
                clic plus loin, dit rouge. Le datum central du produit etait
                rendu en quatre palettes selon l'ecran ; --color-up / --color-down
                sont l'alias chrome de utils/chartPalettes.ts, qui fait autorite. */}
            <span className="font-semibold text-up">↑ {up.toLocaleString()}</span> up
          </span>
          <span>
            <span className="font-semibold text-down">↓ {down.toLocaleString()}</span> down
          </span>
          <span>{(up + down).toLocaleString()} total DEGs</span>
        </div>
      </div>

      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-semibold border border-line text-secondary"
      >
        Analyze <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function DatasetListCard({ datasets }: { datasets: Dataset[] }) {
  return (
    <div className="gl-card p-4">
      <div className="mb-2 text-caption font-semibold uppercase text-muted tracking-[0.06em]">
        Datasets
      </div>

      {datasets.length === 0 ? (
        <p className="text-body-sm text-muted">
          No source datasets yet.
        </p>
      ) : (
        <div className="space-y-2">
          {datasets.slice(0, 6).map((dataset) => (
            <div key={dataset.id} className="flex items-center justify-between text-body-sm text-secondary">
              <span className="truncate" title={dataset.name}>
                {dataset.name}
              </span>
              <span className="inline-flex items-center gap-2 text-caption">
                <DatasetStatusDot status={dataset.status} /> {dataset.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoTabCard({
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
}) {
  return (
    <div className="mt-4 gl-card p-5">
      <h2 className="font-display text-body font-semibold text-primary">
        {title}
      </h2>
      <p className="mt-1 text-body-sm text-secondary">
        {description}
      </p>
      {ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-3 inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-caption font-semibold text-on-accent bg-accent"
        >
          {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : (
        <p className="mt-3 text-caption text-muted">
          A ready matrix dataset is required first.
        </p>
      )}
    </div>
  );
}

function DatasetStatusDot({ status }: { status: string }) {
  if (status === DatasetStatus.READY) {
    return <Dot variant="ready" size={7} />;
  }
  if (status === DatasetStatus.PROCESSING) {
    return <Dot variant="processing" size={7} />;
  }
  if (status === DatasetStatus.FAILED) {
    return <Dot variant="failed" size={7} />;
  }
  return <Dot variant="pending" size={7} />;
}
