'use client';

import { Dialog } from '@/components/ui/dialog';
import ThresholdControl from '@/components/comparison/explorer/ThresholdControl';

/**
 * Les seuils de la page, dans une boîte.
 *
 * Ils quittent le corps de la page : un réglage que tout chiffre et tout graphique lisent n'a pas
 * à se tenir au milieu d'un chapitre. Les processus, eux, suivent le seuil du fichier
 * d'enrichissement, d'où une phrase qui ne les nomme pas. La pastille de l'en-tête dit leur
 * valeur ; la boîte les change via le même `ThresholdControl` que la vue agrandie du volcano —
 * donc la même source, et la même borne (ce qui a été stocké à l'ingestion).
 */
export default function ThresholdsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Thresholds"
      description="One setting for every count and chart on this page."
    >
      <ThresholdControl />
    </Dialog>
  );
}
