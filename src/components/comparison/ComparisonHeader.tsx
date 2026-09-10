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

import Link from 'next/link';
import { ArrowLeft, Calendar, Database, RefreshCw, Sparkles } from 'lucide-react';
import type { Dataset, Project } from '@/types';
import { formatDate } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import ComparisonReportButton from '@/components/ComparisonReportButton';

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
    <>
      <Link
        href={analysisId ? `/projects/${projectId}/analyses/${analysisId}` : `/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4" /> {analysisId ? 'Back to Analysis' : 'Back to Project'}
      </Link>

      <div className="gl-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="page-title">{decodedName}</h1>
            <div
              className="mt-1 flex flex-wrap items-center gap-4 text-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Database className="h-4 w-4" /> Project: {project.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> Created {formatDate(degDataset.created_at)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onOpenChat} title="Open the AI Assistant for this comparison">
              <Sparkles className="h-3.5 w-3.5" />
              AI Assistant
            </Button>
            {reportUnlocked && (
              <ComparisonReportButton
                datasetId={degDataset.id}
                comparisonName={actualComparisonName}
              />
            )}
            <Button variant="outline" size="sm" onClick={onReprocess} disabled={reprocessing}>
              <RefreshCw className={`h-3.5 w-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              {reprocessing ? 'Reprocessing…' : 'Reprocess'}
            </Button>
          </div>
        </div>

        {statsLoading ? (
          <div className="mt-4 inline-flex items-center gap-2 text-body-sm text-muted">
            <RefreshCw className="h-4 w-4 animate-spin" /> Calculating DEG statistics…
          </div>
        ) : null}
      </div>
    </>
  );
}
