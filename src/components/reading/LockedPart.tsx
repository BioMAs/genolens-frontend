'use client';

import { Lock } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useModuleAccessRequest } from '@/hooks/useModuleAccessRequest';
import type { ModuleId } from '@/components/modules/ModuleSelector';

/**
 * Ce que dit une vue verrouillée : le titre nomme le module qui manque, le texte dit ce que la
 * vue ferait. Partagé par la vue agrandie et par les parties de la page, pour qu'un même verrou
 * ne se dise pas de deux façons.
 */
export const LOCKED_COPY: Record<
  'gsea' | 'signature' | 'targets' | 'claims' | 'report',
  { title: string; body: string }
> = {
  gsea: {
    title: 'GSEA needs the scientific module',
    body: 'Ranks every gene against gene sets to find coordinated shifts that thresholds miss. Your plan does not include it.',
  },
  signature: {
    title: 'Signature score needs the scientific module',
    body: 'Scores every sample of the study against a gene list you choose. Your plan does not include it.',
  },
  targets: {
    title: 'Drug targets need the drug discovery module',
    body: 'Ranks the genes that move here by how druggable they are. Your plan does not include it.',
  },
  claims: {
    title: 'Skin claims need the CosmOmics module',
    body: 'Reads this comparison against cosmetic claims and shows which pathways support or contradict each one. Your plan does not include it.',
  },
  report: {
    title: 'Report layout needs the reporting module',
    body: 'Brands the PDF report with your logo, colours and cover pages. Your plan does not include it.',
  },
};

interface LockedPartProps {
  /**
   * Le module à demander : `claim` (peau), `drugdiscovery` (cibles), `science` (GSEA, signature),
   * `reporting` (mise en page du rapport).
   */
  module: ModuleId;
  title: string;
  body: string;
}

/**
 * Le bloc d'une vue que le plan n'inclut pas : un cadenas, ce qui manque, et le moyen de le demander.
 *
 * Il remplace le module, il ne le floute pas : l'appelant ne monte pas le composant verrouillé, si
 * bien que rien n'est demandé au serveur ni rendu derrière. Le bloc ne sait que demander l'accès.
 *
 * Le bouton garde son nom, `Ask for access`, de bout en bout. Une fois la demande envoyée (ou
 * pendant qu'elle part) il passe `aria-disabled` et non `disabled` : il reste dans l'ordre de
 * tabulation et garde son nom, mais un second clic ne renvoie rien. Après un échec il reste actif,
 * pour réessayer. Le message du hook (`notice`) se lit dans une région `status` qui existe avant
 * lui, sans quoi un lecteur d'écran n'annoncerait pas son arrivée.
 */
export default function LockedPart({ module, title, body }: LockedPartProps) {
  const { request, pending, notice, requested } = useModuleAccessRequest();
  const settled = requested.includes(module) || pending === module;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-pill bg-surface-2 text-muted">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="text-title font-medium text-primary">{title}</h3>
      <p className="text-body-sm text-secondary">{body}</p>
      <button
        type="button"
        aria-disabled={settled}
        onClick={() => {
          if (!settled) request(module);
        }}
        className={buttonClasses({
          variant: 'outline',
          size: 'sm',
          className: 'aria-disabled:cursor-default aria-disabled:opacity-60',
        })}
      >
        Ask for access
      </button>
      <p
        role="status"
        className={cn(
          'min-h-[1.25rem] text-caption',
          notice?.kind === 'error' ? 'text-danger' : 'text-secondary',
        )}
      >
        {notice?.text}
      </p>
    </div>
  );
}
