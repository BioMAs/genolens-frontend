'use client';

/**
 * L'identite de la comparaison et ses actions, au-dessus de l'ecran ouvert.
 *
 * L'en-tete ne porte plus de decompte. Il affichait quatre pastilles
 * (Upregulated / Downregulated / Total DEGs / Genes tested) alors que
 * ComparisonSynthesis, juste en dessous, enonce la meme repartition en une
 * phrase et une barre d'equilibre, et que SynthesisStrip la redonne une
 * troisieme fois a l'interieur d'Explore. Le meme chiffre etait rendu trois
 * fois dans le premier ecran, dans trois langages visuels differents.
 *
 * C'etait aussi le rendu aux mauvaises couleurs : « Upregulated » y etait
 * emerald et « Downregulated » violet, quand tous les graphiques disent vert
 * et rouge. La synthese est conservee parce qu'elle est la seule des trois a
 * expliquer ce que les chiffres signifient.
 *
 * L'action de retraitement reste un prop : son gestionnaire porte une boucle
 * de sondage de cinq secondes qui appartient a une mutation, et la deplacer
 * ici l'enterrerait au lieu de la corriger.
 */

import { Calendar, Database, RefreshCw, Sparkles } from 'lucide-react';
import type { Dataset, Project } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import ComparisonReportButton from '@/components/ComparisonReportButton';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/cn';

interface Props {
  projectId: string;
  analysisId?: string;
  project: Project;
  degDataset: Dataset;
  decodedName: string;
  actualComparisonName: string;
  statsLoading: boolean;
  reportUnlocked: boolean;
  reprocessing: boolean;
  onReprocess: () => void;
  onOpenChat: () => void;
}

export default function ComparisonHeader({
  projectId,
  analysisId,
  project,
  degDataset,
  decodedName,
  actualComparisonName,
  statsLoading,
  reportUnlocked,
  reprocessing,
  onReprocess,
  onOpenChat,
}: Props) {
  return (
    /**
     * L'en-tete etait une `gl-card p-5` posee sur le fond de page, precedee d'un
     * lien « Back to… ». Deux consequences :
     *
     *   - un ecran qui commence par une carte n'a pas de titre de page, il a une
     *     premiere carte. La hierarchie demarrait donc un cran trop bas ;
     *   - le retour etait un lien isole, alors que le fil d'Ariane de la barre
     *     superieure dit deja ou l'on est. `PageHeader` l'alimente, ce qui
     *     supprime le lien ET remplit la barre, qui affichait « Comparison ».
     *
     * `titleVariant="name"` existe pour ce cas precis : un nom comme
     * `Treated_D14_vs_Control_D14_female` rendu a 30px/700 ne se lit pas comme
     * un titre, il se lit comme une erreur.
     */
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
      meta={
        <>
          <span className="inline-flex items-center gap-2 text-body-sm text-secondary">
            <Database className="h-4 w-4" /> Project: {project.name}
          </span>
          <span className="inline-flex items-center gap-2 text-body-sm text-secondary">
            <Calendar className="h-4 w-4" /> Created {formatDate(degDataset.created_at)}
          </span>
          {statsLoading ? (
            <span className="inline-flex items-center gap-2 text-body-sm text-muted">
              <RefreshCw className="h-4 w-4 animate-spin" /> Calculating DEG statistics…
            </span>
          ) : null}
        </>
      }
      actions={[
        {
          node: (
            <Button size="sm" onClick={onOpenChat} title="Open the AI Assistant for this comparison">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </Button>
          ),
        },
        ...(reportUnlocked
          ? [
              {
                node: (
                  <ComparisonReportButton
                    datasetId={degDataset.id}
                    comparisonName={actualComparisonName}
                  />
                ),
              },
            ]
          : []),
      ]}
      // Le retraitement est rare, long, et refait un calcul deja fait : il n'a
      // pas sa place a cote de l'action d'arrivee.
      menuItems={[
        {
          label: reprocessing ? 'Reprocessing…' : 'Reprocess DEG',
          icon: <RefreshCw className={cn('h-3.5 w-3.5', reprocessing ? 'animate-spin' : '')} />,
          onSelect: reprocessing ? undefined : onReprocess,
        },
      ]}
    />
  );
}
