'use client';

import AIInterpretationPanel from '@/components/AIInterpretationPanel';
import ReadingChapter from '../ReadingChapter';

interface MeaningChapterProps {
  datasetId: string;
  comparisonName: string;
}

/**
 * Chapitre 4, « What does it mean biologically? » : le panneau de lecture IA existant, tel quel.
 *
 * Aucun appel ici : le panneau lit le texte enregistré au montage et ne génère qu'au clic de
 * l'utilisateur (chaque génération consomme une requête IA d'un compte plafonné, spec § 8.2).
 * Le chapitre n'a pas de bouton d'agrandissement : la figure est le texte, et le panneau porte
 * déjà son bouton de génération, ses sources et sa boîte de question.
 */
export default function MeaningChapter({ datasetId, comparisonName }: MeaningChapterProps) {
  return (
    <ReadingChapter part="meaning" number={4} title="What does it mean biologically?">
      <AIInterpretationPanel datasetId={datasetId} comparisonName={comparisonName} />
    </ReadingChapter>
  );
}
