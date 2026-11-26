'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useComparisonActions } from '@/contexts/ComparisonSelectionContext';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import { useTopPathways, type TopPathway } from '@/hooks/useTopPathways';
import { ENRICHMENT_LOAD_FAILED, NO_ENRICHMENT_FILE, NO_PROCESS_ENRICHED } from '../answers';
import ChapterTools from '../ChapterTools';
import ReadingChapter from '../ReadingChapter';
import type { FocusKind } from '../readingRoutes';

interface ProcessesChapterProps {
  /** Le dataset d'ENRICHISSEMENT de la comparaison ; absent quand aucun n'est rattaché. */
  enrichmentDatasetId: string | undefined;
  comparisonName: string;
  /** Pour le cadenas du GSEA, que le module scientifique garde. */
  access: ModuleAccess;
  onOpenFocus: (kind: FocusKind) => void;
}

/**
 * Un padj que le serveur a arrondi à zéro n'a pas de -log10 : on le plafonne pour que la barre
 * reste dessinable (même valeur que l'ancienne carte `OverviewTopPathways`).
 */
const PADJ_ZERO_SCORE = 30;

const score = (padj: number): number => (padj > 0 ? -Math.log10(padj) : PADJ_ZERO_SCORE);

/**
 * La couleur de la barre dit le sens ; le jeton suit le mode daltonien. Sans sens (enrichissement
 * « tous les DEG »), l'ardoise neutre : une jauge, pas une direction.
 */
const BAR_TONE: Record<'up' | 'down' | 'none', string> = {
  up: 'bg-up',
  down: 'bg-down',
  none: 'bg-[var(--gl-slate)]',
};

function ProcessRow({
  pathway,
  max,
  onPick,
}: {
  pathway: TopPathway;
  max: number;
  onPick: (pathway: TopPathway) => void;
}) {
  const value = score(pathway.padj);
  const { direction } = pathway;

  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(pathway)}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-control px-2 py-1.5 text-left hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_3rem]"
      >
        <span className="flex items-start gap-2 text-body-sm text-primary">
          {direction === 'up' && <ArrowUp className="mt-1 h-3.5 w-3.5 shrink-0 text-up-strong" aria-hidden />}
          {direction === 'down' && <ArrowDown className="mt-1 h-3.5 w-3.5 shrink-0 text-down-strong" aria-hidden />}
          <span>
            {pathway.name}
            {direction && <span className="sr-only">{direction === 'up' ? ', rises' : ', falls'}</span>}
          </span>
        </span>
        <span className="order-last col-span-2 h-2 rounded-pill bg-surface-2 sm:order-none sm:col-span-1" aria-hidden>
          <span
            data-testid="process-bar"
            className={cn('block h-full rounded-pill', BAR_TONE[direction ?? 'none'])}
            style={{ width: `${(value / max) * 100}%` }}
          />
        </span>
        <span className="text-right font-mono text-caption tabular-nums text-secondary">{value.toFixed(1)}</span>
      </button>
    </li>
  );
}

/**
 * Chapitre 3, « Which processes move? » : les processus enrichis en barres horizontales, de la
 * plus forte à la plus faible, longueur = `-log10 padj`.
 *
 * Les voies viennent de `useTopPathways` (le cache du dataset d'enrichissement, aucun calcul).
 * Un clic sur une barre donne la voie à regarder à `focusTerm` avec ses gènes, et la fiche du
 * processus s'ouvre. La liste complète et la table sont dans la vue agrandie « Every process » ;
 * le GSEA a sa propre vue, dans la rangée discrète sous les barres, avec un cadenas quand le plan
 * ne l'inclut pas (et seulement une fois le profil connu, comme le menu).
 *
 * Quand il n'y a rien à classer le chapitre dit la même phrase que la réponse 3 de la colonne
 * vertébrale (`NO_ENRICHMENT_FILE`, `NO_PROCESS_ENRICHED`) : la réponse et sa preuve ne se
 * contredisent pas. Un échec de lecture n'est PAS pris pour un fichier absent : il se dit avec
 * `ENRICHMENT_LOAD_FAILED`, la phrase de la réponse 3 aussi. Le bouton reste là dans tous les cas :
 * la vue agrandie dit ce qui manque.
 */
export default function ProcessesChapter({
  enrichmentDatasetId,
  comparisonName,
  access,
  onOpenFocus,
}: ProcessesChapterProps) {
  const { pathways, isLoading, isError } = useTopPathways(enrichmentDatasetId, comparisonName);
  const { focusTerm, setFocusedGene } = useComparisonActions();

  // La fiche du processus s'ouvre d'après la voie regardée (la page la monte). Une seule fiche à la
  // fois et le gène l'emporte sur la voie : sans lâcher le gène regardé, la fiche de ce gène
  // resterait là et le clic ne montrerait rien. Les gènes de la voie ne deviennent la sélection que
  // par « Select these genes », dans la fiche.
  const pick = ({ id, name, genes, padj }: TopPathway) => {
    setFocusedGene(null);
    focusTerm({ id, name, genes, padj });
  };
  // Pas de cadenas tant que le profil n'est pas arrivé : tous les drapeaux sont faux d'ici là.
  const gseaLocked = access.loaded && !access.science;

  let body;
  if (pathways && pathways.length > 0) {
    const max = Math.max(...pathways.map((p) => score(p.padj)));
    body = (
      <div className="space-y-2">
        <p className="text-caption text-muted">
          Bar length is the −log10 of the adjusted p; the arrow gives the direction.
        </p>
        <ul className="space-y-1">
          {pathways.map((pathway, index) => (
            <ProcessRow
              key={pathway.id || `${pathway.name}-${index}`}
              pathway={pathway}
              max={max}
              onPick={pick}
            />
          ))}
        </ul>
      </div>
    );
  } else if (pathways) {
    body = <p className="text-body-sm text-secondary">{NO_PROCESS_ENRICHED}</p>;
  } else if (isLoading) {
    body = (
      <p role="status" className="text-body-sm text-muted">
        Loading…
      </p>
    );
  } else if (isError) {
    body = <p className="text-body-sm text-secondary">{ENRICHMENT_LOAD_FAILED}</p>;
  } else {
    body = <p className="text-body-sm text-secondary">{NO_ENRICHMENT_FILE}</p>;
  }

  return (
    <ReadingChapter
      part="processes"
      number={3}
      title="Which processes move?"
      action={
        <Button variant="outline" size="sm" onClick={() => onOpenFocus('processes')}>
          Every process
        </Button>
      }
    >
      {body}
      <ChapterTools
        label="More views of the processes"
        tools={[{ label: 'GSEA', focus: 'gsea', locked: gseaLocked }]}
        onOpenFocus={onOpenFocus}
      />
    </ReadingChapter>
  );
}
