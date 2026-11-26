'use client';

/**
 * L'identité de la comparaison lue, et ce qu'on peut en faire d'emblée.
 *
 * Quatre éléments, pas un de plus :
 *   - le titre, qui est le nom de la comparaison (le seul `h1` de la page) ;
 *   - une phrase qui dit CE QUI est comparé — les deux conditions et leurs effectifs ;
 *   - la pastille des seuils, qui dit à quelles valeurs tout ce qui suit est compté et ouvre le
 *     dialogue qui les change ;
 *   - le rapport, seule action marquée : c'est ce que l'on emporte de cette page. À côté, un
 *     bouton discret « Report layout » ouvre l'éditeur de mise en page (la vue agrandie
 *     `report`), que l'ancien onglet « Report » montait ; les deux suivent le même verrou.
 *
 * Ce qui n'y est plus, par rapport à `ComparisonHeader` : le bouton « AI Assistant » (la lecture
 * IA est un chapitre de la page) et le menu « Reprocess DEG », qui vit dans la vue agrandie
 * « Methods » jusqu'à ce que le lot 4 le range dans l'étude — un recalcul rare et long n'a pas sa
 * place à côté de l'action d'arrivée.
 * Les trois métadonnées (projet, date, calcul en cours) tombent aussi : le fil d'Ariane dit déjà
 * le projet, et la page n'attend plus de statistiques pour s'afficher.
 */

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import ComparisonReportButton from '@/components/ComparisonReportButton';
import ThresholdsDialog from '@/components/reading/ThresholdsDialog';
import { useThresholds } from '@/contexts/ComparisonSelectionContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';

export interface ReadingConditions {
  a: string;
  na: number;
  b: string;
  nb: number;
}

interface Props {
  projectId: string;
  project: Project;
  /** Le nom de la comparaison tel que l'URL le porte : le titre et le dernier maillon du fil. */
  decodedName: string;
  /** Les deux conditions et leurs effectifs ; `null` tant qu'on ne les connaît pas (pas de phrase). */
  conditions: ReadingConditions | null;
  access: ModuleAccess;
  /** Le jeu DEG de la comparaison ; `null` tant qu'il n'est pas résolu (pas de rapport). */
  degDatasetId: string | null;
  /**
   * La clé de la comparaison telle que le serveur la stocke, quand elle diffère de l'URL (un lien
   * qui porte le nom d'affichage du jeu, « DEG Analysis — KO vs WT », plutôt que « KO_vs_WT »).
   * C'est elle que le rapport demande : avec le nom de l'URL il chercherait une clé qui n'existe pas.
   */
  actualComparisonName?: string;
  /** Présent quand la comparaison est lue dans une analyse : le fil d'Ariane y ramène. */
  analysisId?: string;
  /** Ouvre l'éditeur de mise en page du rapport (la vue agrandie `report`). */
  onOpenReportLayout: () => void;
}

export default function ReadingHeader({
  projectId,
  project,
  decodedName,
  conditions,
  access,
  degDatasetId,
  actualComparisonName,
  analysisId,
  onOpenReportLayout,
}: Props) {
  const { padj, logfc } = useThresholds();
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  // Le verrou du rapport est celui de l'ancien en-tête : sa mise en page se personnalise avec le
  // module « report ». Tant que le profil n'est pas arrivé `access.report` est faux, donc le
  // bouton n'apparaît pas pour disparaître ensuite.
  const showReport = degDatasetId !== null && access.report;

  return (
    <>
      <PageHeader
        title={decodedName}
        titleVariant="name"
        crumbs={[
          { label: 'Projects', href: '/projects' },
          {
            label: project.name,
            href: analysisId
              ? `/projects/${projectId}/analyses/${analysisId}`
              : `/projects/${projectId}`,
          },
          { label: decodedName },
        ]}
        description={
          conditions
            ? `${conditions.a} (${conditions.na} samples) against ${conditions.b} (${conditions.nb})`
            : undefined
        }
        meta={
          <Button
            variant="outline"
            size="sm"
            aria-haspopup="dialog"
            onClick={() => setThresholdsOpen(true)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            {`Thresholds: padj < ${padj}, |log2FC| > ${logfc}`}
          </Button>
        }
        actions={[
          ...(access.report
            ? [
                {
                  node: (
                    <Button variant="ghost" size="sm" aria-haspopup="dialog" onClick={onOpenReportLayout}>
                      Report layout
                    </Button>
                  ),
                },
              ]
            : []),
          ...(showReport
            ? [
                {
                  node: (
                    <ComparisonReportButton
                      datasetId={degDatasetId}
                      comparisonName={actualComparisonName ?? decodedName}
                    />
                  ),
                },
              ]
            : []),
        ]}
      />
      <ThresholdsDialog open={thresholdsOpen} onClose={() => setThresholdsOpen(false)} />
    </>
  );
}
