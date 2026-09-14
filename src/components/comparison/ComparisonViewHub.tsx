'use client';

/**
 * Les quatre ecrans d'une comparaison, en controle segmente.
 *
 * C'etaient quatre grandes cartes de 2x2 ou 1x4, avec icone, numero, titre,
 * description et decompte. Elles etaient la troisieme couche d'orientation
 * empilee avant le moindre contenu — apres l'en-tete et apres la synthese —
 * et repoussaient le nuage de volcan a plus de 500px du haut de page. Sur une
 * page de resultats, l'orientation ne doit pas couter plus cher que ce qu'elle
 * oriente.
 *
 * Le numero reste : VIEW_ORDER est une sequence, pas un ensemble — explorer
 * les genes, comprendre ce qu'ils signifient, appliquer la comparaison,
 * partager le resultat.
 *
 * La description et le decompte de sections passent en `sr-only`. Ils gardent
 * leur valeur pour un lecteur d'ecran, ou l'espace ne coute rien, mais ils
 * n'ont jamais ete la raison d'un clic : on choisit « Understand » parce qu'on
 * veut comprendre, pas parce qu'il annonce trois sections.
 *
 * Delibirement un commutateur et non un menu de sections : a l'interieur d'un
 * ecran, SectionRail liste deja les sections et marque ou l'on est.
 */

import { SegmentedControl, type SegmentItem } from '@/components/ui/tabs';
import type { ComparisonViewGroup } from './comparisonModules';
import { VIEW_ICONS, type ComparisonView } from './comparisonRoutes';

interface Props {
  /** `groupModulesByView(...)` — les quatre, dans l'ordre de VIEW_ORDER. */
  groups: ComparisonViewGroup[];
  activeView: ComparisonView;
  onSelect: (view: ComparisonView) => void;
}

/**
 * Ce que contient cet ecran, en une ligne.
 *
 * Le nombre de sections vient en premier parce que c'est le chiffre utile ; le
 * reste n'apparait que s'il y a quelque chose a expliquer.
 */
function summarise({ counts }: ComparisonViewGroup): string {
  const total = counts.ready + counts['needs-data'] + counts.locked;
  if (total === 0) return 'Nothing here for this comparison';

  const parts = [`${total} section${total === 1 ? '' : 's'}`];
  if (counts.locked > 0) parts.push(`${counts.locked} locked`);
  if (counts['needs-data'] > 0) parts.push(`${counts['needs-data']} needs data`);
  return parts.join(' · ');
}

export default function ComparisonViewHub({ groups, activeView, onSelect }: Props) {
  const items: SegmentItem<ComparisonView>[] = groups.map((group, index) => {
    const Icon = VIEW_ICONS[group.view];
    return {
      value: group.view,
      label: group.label,
      icon: (
        <span className="flex shrink-0 items-center gap-2">
          {/* Le numero est un repere d'ordre, pas un controle : le lecteur
              d'ecran tire le meme ordre de la liste elle-meme. */}
          <span aria-hidden className="tabular-nums opacity-60">
            {index + 1}
          </span>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      ),
      srOnly: `${group.description} ${summarise(group)}`,
    };
  });

  return (
    <SegmentedControl
      stretch
      label="Screens of this comparison"
      items={items}
      value={activeView}
      onValueChange={onSelect}
      itemLabel={(item) => `Open ${item.label}`}
    />
  );
}
