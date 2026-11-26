'use client';

/**
 * La lecture d'une comparaison : une page qui se lit de haut en bas.
 *
 * L'en-tête, puis deux colonnes à partir de 75 rem : le menu des parties à gauche, la lecture à
 * droite (les cinq réponses, puis un chapitre par question). Les outils lourds s'ouvrent dans la
 * vue agrandie, jamais dans la page.
 *
 * **L'URL est l'état.** La partie et la vue agrandie se lisent dans l'URL à chaque rendu
 * (`resolveReadingTarget`), anciennes formes comprises : un lien froid peint la bonne vue dès sa
 * première image. À l'arrivée, l'URL est réécrite une fois dans sa forme canonique
 * (`readingLocation`), la page défile jusqu'à la partie nommée, et ouvrir ou fermer une vue
 * agrandie écrit ou retire `?focus=`. Toujours `replaceState` : naviguer dans une lecture n'empile
 * pas d'entrées d'historique, et `useSearchParams` suit (Next ≥ 14.1).
 *
 * Remplace `ComparisonDetail`, qui reste dans le dépôt jusqu'au lot de nettoyage. Ses états de
 * chargement, d'erreur et d'absence sont repris tels quels.
 */

import { useCallback, useEffect, useId, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { Dataset, Project } from '@/types';
import { ComparisonSelectionProvider } from '@/contexts/ComparisonSelectionContext';
import {
  useComparisonContext,
  type ComparisonContext,
} from '@/components/comparison/useComparisonContext';
import GeneListDeepLink from '@/components/comparison/explorer/GeneListDeepLink';
import type { ComparisonSamples } from '@/hooks/useComparisonSamples';
import { useLocationHash } from '@/hooks/useLocationHash';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import FocusDialog, { type FocusContext } from './FocusDialog';
import ReadingHeader, { type ReadingConditions } from './ReadingHeader';
import ReadingMenu from './ReadingMenu';
import ReadingSpine from './ReadingSpine';
import CountsChapter from './chapters/CountsChapter';
import GenesChapter from './chapters/GenesChapter';
import ProcessesChapter from './chapters/ProcessesChapter';
import MeaningChapter from './chapters/MeaningChapter';
import ApplicationsChapter from './chapters/ApplicationsChapter';
import { useActivePart } from './useActivePart';
import { useReadingData } from './useReadingData';
import {
  partDomId,
  READING_PARTS,
  readingLocation,
  resolveReadingTarget,
  type FocusKind,
  type ReadingPart,
} from './readingRoutes';

/** La dernière lecture, que l'accueil reprendra (lot 5) : `{ projectId, comparisonName, at }`. */
export const LAST_READING_KEY = 'gl-last-reading';

interface ReadingPageProps {
  projectId: string;
  /** Le nom de la comparaison tel que la route le porte, encodé. */
  comparisonName: string;
  analysisId?: string;
}

/** Les parties suivies par le menu, dans l'ordre de la page. */
const PART_IDS: readonly ReadingPart[] = READING_PARTS.map((p) => p.id);
const ANSWERS_LABEL = READING_PARTS.find((p) => p.id === 'answers')?.label ?? 'Answers';

/** Un lien de partie est une ancre de la page : la requête (seuils, gène, focus) reste. */
const hrefFor = (part: ReadingPart) => `#${partDomId(part)}`;

/** Réécrit l'URL sans rechargement ni entrée d'historique, si elle change. */
function replaceLocation(search: string, hash: string) {
  const { pathname } = window.location;
  const next = `${pathname}${search}${hash}`;
  if (next !== `${pathname}${window.location.search}${window.location.hash}`) {
    window.history.replaceState(null, '', next);
  }
}

/**
 * Les deux conditions et leurs effectifs, comme `ComparisonSynthesis` les comptait : les deux
 * moitiés du nom (`KO_vs_WT`) et les échantillons de chacune. Rien quand un côté n'en a aucun :
 * « KO (3 samples) against WT (0) » ne décrirait pas ce qui a été comparé.
 */
function conditionsOf({ conditions, conditionMap }: ComparisonSamples): ReadingConditions | null {
  if (!conditions) return null;
  const values = Object.values(conditionMap);
  const count = (condition: string) => values.filter((value) => value === condition).length;
  const na = count(conditions.left);
  const nb = count(conditions.right);
  return na > 0 && nb > 0 ? { a: conditions.left, na, b: conditions.right, nb } : null;
}

/**
 * Le fournisseur de sélection enveloppe tout, la vue agrandie comprise : seuils, gène regardé et
 * voie regardée sont ceux de la page, et `useExplorerUrlSync` y garde `?padj=`, `?lfc=`, `?gene=`.
 */
export default function ReadingPage(props: ReadingPageProps) {
  return (
    <ComparisonSelectionProvider>
      <ReadingResolver {...props} />
    </ComparisonSelectionProvider>
  );
}

/** Résout la comparaison ; les états d'attente et d'échec sont ceux de `ComparisonDetail`. */
function ReadingResolver({ projectId, comparisonName, analysisId }: ReadingPageProps) {
  const searchParams = useSearchParams();
  const globalDatasetId = searchParams.get('datasetId');
  const context = useComparisonContext({ projectId, comparisonName, analysisId, globalDatasetId });
  const { project, degDataset } = context;

  if (context.isLoading) {
    return <div className="p-8 text-center text-body-sm text-muted">Loading…</div>;
  }
  if (context.isError) {
    return (
      <div className="p-8 text-center text-body-sm text-muted">Failed to load comparison details.</div>
    );
  }
  if (!project) {
    return <div className="p-8 text-center text-body-sm text-muted">Project not found</div>;
  }
  if (!degDataset) {
    return (
      <div className="py-8">
        <div className="page-container">
          <Link
            href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`}
            className="mb-4 inline-flex items-center text-body-sm text-secondary hover:text-primary"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
          </Link>
          <div className="mt-4 rounded-sm bg-warning-soft p-4">
            <p className="text-warning-ink">
              No Differential Expression (DEG) dataset found for this comparison.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Reading
      projectId={projectId}
      analysisId={analysisId}
      globalDatasetId={globalDatasetId}
      context={context}
      project={project}
      degDataset={degDataset}
    />
  );
}

interface ReadingProps {
  projectId: string;
  analysisId?: string;
  globalDatasetId: string | null;
  context: ComparisonContext;
  /** Résolus : la lecture n'est montée qu'une fois la comparaison trouvée. */
  project: Project;
  degDataset: Dataset;
}

function Reading({ projectId, analysisId, globalDatasetId, context, project, degDataset }: ReadingProps) {
  const { decodedName, actualComparisonName, enrichmentDataset, matrixDataset, samples, geneMap } =
    context;
  const access = useModuleAccess();
  const { summary, tested, answers } = useReadingData({
    degDataset,
    enrichmentDataset,
    decodedName,
    actualComparisonName,
    globalDatasetId,
    access,
  });
  const active = useActivePart(PART_IDS);
  const answersHeadingId = useId();
  const headerRef = useRef<HTMLDivElement>(null);

  // Dérivée au rendu, jamais recopiée : la vue agrandie ouverte EST celle que l'URL nomme.
  const searchParams = useSearchParams();
  const hash = useLocationHash();
  const { focus } = resolveReadingTarget(searchParams, hash);

  // L'arrivée, une fois : l'URL canonique, puis le défilement. Ici et non dans `ReadingResolver`,
  // pour que la partie visée soit dans la page quand on y défile.
  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const target = resolveReadingTarget(current, window.location.hash);
    const { search, hash: nextHash } = readingLocation(target, current);
    replaceLocation(search, nextHash);

    if (target.report) {
      // `ComparisonReportButton` garde son ouverture dans un état interne, sans prop pour la
      // commander, et sans le module de personnalisation son clic lance directement la
      // génération : un lien ne doit pas déclencher un calcul. On amène donc le lecteur au bouton,
      // dans l'en-tête, plutôt que d'ouvrir le rapport à sa place.
      headerRef.current?.scrollIntoView();
    } else if (target.part !== 'answers') {
      document.getElementById(partDomId(target.part))?.scrollIntoView();
    }
  }, []);

  // Retenue pour l'accueil ; un stockage bloqué (navigation privée, réglages) n'empêche pas de lire.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        LAST_READING_KEY,
        JSON.stringify({ projectId, comparisonName: actualComparisonName, at: new Date().toISOString() })
      );
    } catch {
      // Rien à faire : l'accueil ne proposera simplement pas de reprendre cette lecture.
    }
  }, [projectId, actualComparisonName]);

  /** Ouvre ou ferme une vue agrandie : seul `?focus=` change, la partie et le reste demeurent. */
  const setFocus = useCallback((kind: FocusKind | null) => {
    const current = new URLSearchParams(window.location.search);
    const target = resolveReadingTarget(current, window.location.hash);
    const { search, hash: nextHash } = readingLocation({ ...target, focus: kind }, current);
    replaceLocation(search, nextHash);
  }, []);
  const openFocus = useCallback((kind: FocusKind) => setFocus(kind), [setFocus]);
  const closeFocus = useCallback(() => setFocus(null), [setFocus]);

  // Pas de cadenas tant que le profil n'est pas arrivé : tous les drapeaux sont faux d'ici là.
  const locked = access.loaded
    ? { targets: !access.targets, skin: !access.skin, signature: !access.science }
    : {};

  const focusContext = useMemo<FocusContext>(
    () => ({
      projectId,
      project,
      degDataset,
      enrichmentDataset,
      matrixDataset,
      actualComparisonName,
      samples,
      geneMap,
      sampleConditionMap: samples.conditionMap,
    }),
    [projectId, project, degDataset, enrichmentDataset, matrixDataset, actualComparisonName, samples, geneMap]
  );

  return (
    <div className="page-container">
      <div ref={headerRef} className="scroll-mt-[calc(var(--sticky-top)+1rem)]">
        <ReadingHeader
          projectId={projectId}
          project={project}
          decodedName={decodedName}
          actualComparisonName={actualComparisonName}
          analysisId={analysisId}
          conditions={conditionsOf(samples)}
          access={access}
          degDatasetId={degDataset.id}
        />
      </div>

      {/* Résout un lien `?geneList=` dans la sélection partagée. Ne rend rien. */}
      <GeneListDeepLink projectId={projectId} />

      {/* Sous 75 rem, une colonne, et le menu flotte en bas à droite : la marge du bas lui laisse la
          place de ne rien couvrir en fin de page. Dès 75 rem, deux colonnes ; celle du menu, un
          élément de grille étiré, court sur toute la hauteur de la lecture, et c'est dans elle que
          le menu colle. */}
      <div className="mt-8 pb-16 min-[75rem]:grid min-[75rem]:grid-cols-[minmax(0,12.5rem)_minmax(0,1fr)] min-[75rem]:gap-x-12 min-[75rem]:pb-0">
        <div>
          <ReadingMenu active={active} locked={locked} hrefFor={hrefFor} />
        </div>

        <div className="min-w-0 space-y-12">
          <section
            id={partDomId('answers')}
            aria-labelledby={answersHeadingId}
            className="scroll-mt-[calc(var(--sticky-top)+1rem)]"
          >
            <h2 id={answersHeadingId} className="sr-only">
              {ANSWERS_LABEL}
            </h2>
            <ReadingSpine answers={answers} hrefFor={hrefFor} />
          </section>

          <CountsChapter
            summary={summary}
            tested={tested}
            degDataset={degDataset}
            comparisonName={actualComparisonName}
            onOpenFocus={openFocus}
          />
          <GenesChapter
            datasetId={degDataset.id}
            comparisonName={actualComparisonName}
            onOpenFocus={openFocus}
          />
          <ProcessesChapter
            enrichmentDatasetId={enrichmentDataset?.id}
            comparisonName={actualComparisonName}
            onOpenFocus={openFocus}
          />
          <MeaningChapter datasetId={degDataset.id} comparisonName={actualComparisonName} />
          <ApplicationsChapter
            degDatasetId={degDataset.id}
            comparisonName={actualComparisonName}
            access={access}
            onOpenFocus={openFocus}
          />
        </div>
      </div>

      <FocusDialog kind={focus} context={focusContext} access={access} onClose={closeFocus} />
    </div>
  );
}
