'use client';

/**
 * Ce que la lecture calcule une fois, pour la colonne vertébrale et pour le chapitre des comptes.
 *
 * Sorti de `ReadingPage` pour que la page ne fasse que la mise en page et l'URL. Aucune donnée
 * n'est lue ici qui ne l'était déjà par l'ancienne page ou par un chapitre : les hooks partagent
 * leurs entrées de cache React Query, si bien que la réponse et sa preuve (le chapitre) lisent la
 * même chose, au même seuil, pour une seule requête.
 *
 * **« Genes tested » ne vient jamais de `summary.total`.** C'est la source que `ComparisonDetail`
 * passait à `ComparisonSynthesis` : la métadonnée `deg_tested` du jeu DEG (celle de la comparaison
 * quand l'URL épingle le jeu par `?datasetId=`), sinon `total_genes` de `/datasets/{id}/stats`.
 * Le nuage du volcano est plafonné : sa longueur est un plancher, pas le nombre de gènes testés.
 */

import { useMemo } from 'react';
import type { Dataset } from '@/types';
import { useDatasetStats } from '@/hooks/useDatasets';
import { useSignificanceSummary } from '@/hooks/useSignificanceSummary';
import { useTopGenes } from '@/hooks/useTopGenes';
import { useTopPathways } from '@/hooks/useTopPathways';
import { useSavedInterpretation } from '@/hooks/useSavedInterpretation';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { SignificanceSummary } from '@/utils/volcano';
import { buildAnswers, type Answer, type AnswerKey } from './answers';

/** Les symboles que la réponse 2 nomme, de chaque côté. */
const TOP_UP_NAMED = 3;
const TOP_DOWN_NAMED = 2;

interface ReadingDataInput {
  degDataset: Dataset;
  enrichmentDataset: Dataset | undefined;
  /** Le nom de l'URL, décodé : c'est sous lui que la métadonnée range une comparaison épinglée. */
  decodedName: string;
  /** La clé stockée de la comparaison : celle que tous les endpoints attendent. */
  actualComparisonName: string;
  /** `?datasetId=` : le jeu est épinglé, et peut porter plusieurs comparaisons. */
  globalDatasetId: string | null;
  access: ModuleAccess;
}

export interface ReadingData {
  /** Up / down aux seuils de la page ; `null` tant que le nuage n'est pas là. */
  summary: SignificanceSummary | null;
  /** Le nuage du volcano n'a pas pu être lu (et aucun décompte n'est là) : réponses 1, 2 et chapitre 1. */
  countsFailed: boolean;
  /** Gènes testés ; `null` quand on ne le sait pas. */
  tested: number | null;
  answers: Record<AnswerKey, Answer>;
}

/** Un nombre lu d'une métadonnée ou d'une réponse, qui arrive parfois en chaîne. */
function toCount(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/** Les gènes testés déjà connus du jeu DEG, à l'ingestion ou d'une visite précédente. */
function testedFromMetadata(
  degDataset: Dataset,
  decodedName: string,
  pinned: boolean
): number | undefined {
  const metadata = degDataset.dataset_metadata as Record<string, unknown> | undefined;
  if (!pinned) return toCount(metadata?.deg_tested);

  const comparisons = metadata?.comparisons;
  if (!comparisons || typeof comparisons !== 'object' || Array.isArray(comparisons)) return undefined;
  return toCount((comparisons as Record<string, Record<string, unknown>>)[decodedName]?.deg_tested);
}

export function useReadingData({
  degDataset,
  enrichmentDataset,
  decodedName,
  actualComparisonName,
  globalDatasetId,
  access,
}: ReadingDataInput): ReadingData {
  const pinned = !!globalDatasetId;

  // Le décompte unique de la page, aux seuils du contexte (ceux de l'URL, bornés).
  const { summary } = useSignificanceSummary(degDataset.id, actualComparisonName);

  // Le dénominateur : la métadonnée d'abord, `/stats` seulement quand elle ne l'a pas.
  const fromMetadata = testedFromMetadata(degDataset, decodedName, pinned);
  const stats = useDatasetStats(
    degDataset.id,
    pinned ? decodedName : undefined,
    fromMetadata === undefined
  );
  const testedCount = fromMetadata ?? toCount(stats.data?.total_genes);
  // Zéro gène testé n'est pas une donnée : `ComparisonSynthesis` taisait déjà ce membre de phrase.
  const tested = testedCount !== undefined && testedCount > 0 ? testedCount : null;

  const { up, down, isError: volcanoError } = useTopGenes(degDataset.id, actualComparisonName);
  // Même nuage que `summary` : l'échec ne compte que tant qu'aucun décompte n'est là.
  const countsFailed = summary === null && volcanoError;
  const { pathways, isError: pathwaysError } = useTopPathways(
    enrichmentDataset?.id,
    actualComparisonName
  );
  const { text: interpretation, isLoading: interpretationLoading } = useSavedInterpretation(
    degDataset.id,
    actualComparisonName,
    access.ai
  );
  // La même requête que la partie Skin claims (mêmes arguments, même clé) : une seule au serveur,
  // et rien du tout sans le module.
  const nova = useCosmOmicsNova(degDataset.id, actualComparisonName, access.skin);
  const claims = nova.data?.claims ?? null;

  const answers = useMemo(
    () =>
      buildAnswers({
        summary,
        tested,
        countsFailed,
        topUp: up.slice(0, TOP_UP_NAMED).map((point) => point.gene),
        topDown: down.slice(0, TOP_DOWN_NAMED).map((point) => point.gene),
        pathways,
        // Un fichier rattaché dont les voies ne sont pas là n'est pas « aucun fichier » : elles
        // arrivent, ou leur lecture a échoué, et la réponse dit lequel.
        pathwaysPending: !!enrichmentDataset && pathways === null,
        pathwaysFailed: !!enrichmentDataset && pathways === null && pathwaysError,
        interpretation,
        interpretationLoading,
        access,
        claims,
        // Le module débloqué seulement : sans lui, rien n'est demandé, donc rien n'est en route.
        claimsLoading: access.skin && nova.isLoading,
      }),
    [
      summary,
      tested,
      countsFailed,
      up,
      down,
      pathways,
      pathwaysError,
      enrichmentDataset,
      interpretation,
      interpretationLoading,
      access,
      claims,
      nova.isLoading,
    ]
  );

  return { summary, countsFailed, tested, answers };
}
