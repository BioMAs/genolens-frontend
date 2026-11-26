'use client';

import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import type { Dataset, Project } from '@/types';
import type { ComparisonContext } from '@/components/comparison/useComparisonContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { ModuleId } from '@/components/modules/ModuleSelector';
import {
  DEG_EXPORT_COLUMNS,
  downloadDegStats,
  fetchAllDegGenes,
  toDegExportRow,
} from '@/hooks/useDegGenes';
import { useFocusedTerm, useThresholds } from '@/contexts/ComparisonSelectionContext';
import VolcanoPanel from '@/components/comparison/explorer/VolcanoPanel';
import ThresholdControl from '@/components/comparison/explorer/ThresholdControl';
import HeatmapSection from '@/components/comparison/explorer/HeatmapSection';
import NoMatrix from '@/components/comparison/NoMatrix';
import DEGTable from '@/components/DEGTable';
import ExportMenu from '@/components/ExportMenu';
import MethodStatsPanel from '@/components/MethodStatsPanel';
import StringEnrichmentPanel from '@/components/integrations/StringEnrichmentPanel';
import CustomVisualizationPanel from '@/components/CustomVisualizationPanel';
import GOEnrichmentAnalysis from '@/components/GOEnrichmentAnalysis';
import GSEAAnalysis from '@/components/GSEAAnalysis';
import PPINetworkSection from '@/components/network/PPINetworkSection';
import DrugDiscoveryComparisonPanel from '@/components/tools/dd/DrugDiscoveryComparisonPanel';
import CosmOmicsPanel from '@/components/cosmomics/CosmOmicsPanel';
import SignatureScorePanel from '@/components/SignatureScorePanel';
import LockedPart, { LOCKED_COPY } from './LockedPart';
import type { FocusKind } from './readingRoutes';

/**
 * Ce que la vue agrandie sait de la comparaison : ce que `useComparisonContext` a résolu, réduit à
 * ce que les modules lisent, plus `projectId` et la carte échantillon → condition.
 *
 * `ReadingPage` la construit une fois. Un `degDataset` et un `project` définis : la page ne monte
 * pas la lecture tant que la comparaison n'est pas résolue. `sampleConditionMap` est
 * `samples.conditionMap`, passée à part parce que c'est sous ce nom que les modules la reçoivent.
 */
export interface FocusContext
  extends Pick<
    ComparisonContext,
    'enrichmentDataset' | 'matrixDataset' | 'actualComparisonName' | 'samples' | 'geneMap'
  > {
  projectId: string;
  project: Project;
  degDataset: Dataset;
  sampleConditionMap: Record<string, string>;
}

/** Le titre de chaque vue ; la boîte y ajoute le nom de la comparaison. */
export const FOCUS_TITLES: Record<FocusKind, string> = {
  volcano: 'Volcano',
  table: 'Genes',
  heatmap: 'Heatmap',
  methods: 'Methods',
  lookup: 'Database lookup',
  charts: 'Charts',
  processes: 'Processes',
  gsea: 'GSEA',
  network: 'Interaction network',
  targets: 'Drug targets',
  claims: 'Skin claims',
  signature: 'Signature score',
};

interface FocusView {
  /**
   * Le module que le plan doit inclure : le drapeau d'`access` à lire, le module à demander, et le
   * texte du bloc verrouillé. Absent pour une vue qu'aucun module ne garde.
   */
  lock?: { flag: 'science' | 'targets' | 'skin'; module: ModuleId; copy: keyof typeof LOCKED_COPY };
  render: (context: FocusContext) => ReactNode;
}

/**
 * Les mêmes listes que `ComparisonDetail` passait à ses panneaux : un échantillon absent est
 * `undefined`, pas un tableau vide, que les panneaux traiteraient comme « aucun échantillon ».
 */
const sampleIdsOf = ({ samples }: FocusContext) =>
  samples.sampleIds.length > 0 ? samples.sampleIds : undefined;
const conditionsOf = ({ sampleConditionMap }: FocusContext) =>
  Object.keys(sampleConditionMap).length > 0 ? sampleConditionMap : undefined;

/**
 * Le tableau des gènes et ses deux exports, comme l'ancien panneau d'exports : tous les DEG au
 * seuil courant, et les p-values de chaque méthode.
 */
function TableView({ context }: { context: FocusContext }) {
  const { degDataset, actualComparisonName } = context;
  const thresholds = useThresholds();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-secondary">
          Every differentially expressed gene of this comparison at the current thresholds (padj ≤{' '}
          {thresholds.padj}, |log2FC| &gt; {thresholds.logfc}).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu
            fetchData={async () =>
              (await fetchAllDegGenes(degDataset.id, actualComparisonName, thresholds)).map(
                toDegExportRow
              )
            }
            filename={`${actualComparisonName}_all_DEGs`}
            formats={['csv', 'json']}
            csvColumns={DEG_EXPORT_COLUMNS}
            variant="outline"
            size="sm"
          />
          <button
            type="button"
            className={buttonClasses({ variant: 'outline', size: 'sm' })}
            onClick={() => downloadDegStats(degDataset.id, actualComparisonName)}
          >
            <Download className="h-4 w-4" aria-hidden />
            Per-method p-values (.csv)
          </button>
        </div>
      </div>
      {/* Pas d'`overflow-hidden` : il rognerait les menus « Columns » et d'export du tableau. */}
      <div className="rounded-control bg-surface">
        <DEGTable dataset={degDataset} comparisonName={actualComparisonName} />
      </div>
    </div>
  );
}

/** Le score de signature, ouvert sur la voie que le lecteur regardait, s'il y en avait une. */
function SignatureView({ context, matrixDataset }: { context: FocusContext; matrixDataset: Dataset }) {
  const focusedTerm = useFocusedTerm();
  return (
    <SignatureScorePanel
      projectId={context.projectId}
      matrixDatasetId={matrixDataset.id}
      samples={sampleIdsOf(context)}
      sampleConditionMap={conditionsOf(context)}
      initialGenes={focusedTerm?.genes}
      initialLabel={focusedTerm?.name}
    />
  );
}

/**
 * Une vue → un composant existant, monté avec les propriétés que `ComparisonDetail` lui donnait.
 * Aucune logique de module n'est recopiée ici : la table ne fait que choisir et câbler.
 *
 * `actualComparisonName` partout, jamais le nom de l'URL : c'est la clé stockée, celle que porte
 * `deg_genes.comparison_name`.
 */
export const FOCUS_VIEWS: Record<FocusKind, FocusView> = {
  volcano: {
    render: ({ degDataset, actualComparisonName }) => (
      <div className="space-y-4">
        <ThresholdControl />
        <VolcanoPanel dataset={degDataset} comparisonName={actualComparisonName} />
      </div>
    ),
  },
  table: {
    render: (context) => <TableView context={context} />,
  },
  heatmap: {
    render: (context) =>
      context.matrixDataset ? (
        <HeatmapSection
          degDataset={context.degDataset}
          matrixDataset={context.matrixDataset}
          comparisonName={context.actualComparisonName}
          sampleIds={sampleIdsOf(context)}
          sampleConditionMap={conditionsOf(context)}
        />
      ) : (
        <NoMatrix purpose="Clustering" />
      ),
  },
  methods: {
    render: ({ degDataset, actualComparisonName }) => (
      <MethodStatsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
    ),
  },
  lookup: {
    render: () => <StringEnrichmentPanel />,
  },
  charts: {
    render: ({ degDataset, actualComparisonName, matrixDataset, geneMap }) =>
      matrixDataset ? (
        <CustomVisualizationPanel
          datasetId={degDataset.id}
          comparisonName={actualComparisonName}
          allGenes={geneMap.genes}
        />
      ) : (
        <NoMatrix purpose="Free-form charts" />
      ),
  },
  processes: {
    render: ({ degDataset, enrichmentDataset, actualComparisonName }) => (
      <GOEnrichmentAnalysis
        dataset={degDataset}
        enrichmentDataset={enrichmentDataset}
        comparisonName={actualComparisonName}
      />
    ),
  },
  gsea: {
    lock: { flag: 'science', module: 'science', copy: 'gsea' },
    render: ({ degDataset, actualComparisonName }) => (
      <GSEAAnalysis dataset={degDataset} comparisonName={actualComparisonName} />
    ),
  },
  network: {
    render: ({ degDataset, actualComparisonName, geneMap, project }) => (
      <PPINetworkSection
        dataset={degDataset}
        comparisonName={actualComparisonName}
        geneNameMap={geneMap.nameByGene}
        projectSpecies={project.species}
      />
    ),
  },
  targets: {
    lock: { flag: 'targets', module: 'drugdiscovery', copy: 'targets' },
    render: ({ degDataset, actualComparisonName }) => (
      <DrugDiscoveryComparisonPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
    ),
  },
  claims: {
    lock: { flag: 'skin', module: 'claim', copy: 'claims' },
    render: ({ degDataset, actualComparisonName }) => (
      <CosmOmicsPanel datasetId={degDataset.id} comparisonName={actualComparisonName} />
    ),
  },
  signature: {
    lock: { flag: 'science', module: 'science', copy: 'signature' },
    render: (context) =>
      context.matrixDataset ? (
        <SignatureView context={context} matrixDataset={context.matrixDataset} />
      ) : (
        <NoMatrix purpose="Signature scoring" />
      ),
  },
};

interface FocusDialogProps {
  /** La vue ouverte, ou `null` quand aucune ne l'est. */
  kind: FocusKind | null;
  context: FocusContext;
  access: ModuleAccess;
  onClose: () => void;
}

/**
 * La vue agrandie : un module de la comparaison, en plein écran, au-dessus de la lecture.
 *
 * Les douze vues montent les composants de l'ancienne page, inchangés. Seule règle propre à ce
 * fichier : le verrou. Une vue que le plan n'inclut pas rend `LockedPart` **à la place** du
 * module, qui n'est donc pas monté — ni demandé au serveur, ni rendu, même flouté. Et tant que le
 * profil n'est pas arrivé (`access.loaded`), une vue gardée n'affiche ni l'un ni l'autre : un
 * lien `?focus=gsea` ouvert à froid par quelqu'un qui a le module ne doit pas montrer un cadenas.
 *
 * Elle exige un `ComparisonSelectionProvider` au-dessus : seuils, sélection et voie regardée y
 * vivent.
 */
export default function FocusDialog({ kind, context, access, onClose }: FocusDialogProps) {
  if (kind === null) return null;

  const view = FOCUS_VIEWS[kind];
  const { lock } = view;

  let body: ReactNode;
  if (!lock || access[lock.flag]) {
    body = view.render(context);
  } else if (!access.loaded) {
    body = (
      <div role="status" className="p-8 text-center text-body-sm text-muted">
        Loading…
      </div>
    );
  } else {
    const copy = LOCKED_COPY[lock.copy];
    body = <LockedPart module={lock.module} title={copy.title} body={copy.body} />;
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="full"
      title={`${FOCUS_TITLES[kind]}, ${context.actualComparisonName}`}
    >
      {body}
    </Dialog>
  );
}
