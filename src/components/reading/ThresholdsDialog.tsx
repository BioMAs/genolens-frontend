'use client';

import { Dialog } from '@/components/ui/dialog';
import ThresholdControl from '@/components/comparison/explorer/ThresholdControl';

/**
 * Les seuils de la page, dans une boîte.
 *
 * Ils quittent le corps de la page : un réglage que tout chiffre, tout graphique et tout
 * processus lisent n'a pas à se tenir au milieu d'un chapitre. La pastille de l'en-tête dit leur
 * valeur ; cette boîte est le seul endroit où on les change, via le même `ThresholdControl` que
 * partout — donc la même source, et la même borne (ce qui a été stocké à l'ingestion).
 */
export default function ThresholdsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thresholds"
      description="One setting for every count, chart and process on this page."
    >
      <ThresholdControl />
    </Dialog>
  );
}
