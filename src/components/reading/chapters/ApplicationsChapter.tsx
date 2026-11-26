'use client';

import { useId, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ModuleId } from '@/components/modules/ModuleSelector';
import CosmOmicsNova from '@/components/cosmomics/CosmOmicsNova';
import NovaClaimCard, { NovaClaimList } from '@/components/cosmomics/NovaClaimCard';
import NovaLegend from '@/components/cosmomics/NovaLegend';
import { useCosmOmicsNova } from '@/hooks/useCosmOmicsNova';
import type { ModuleAccess } from '@/hooks/useModuleAccess';
import type { CosmOmicsNovaData } from '@/types/cosmomics';
import LockedPart, { LOCKED_COPY } from '../LockedPart';
import ReadingChapter from '../ReadingChapter';
import { partDomId, READING_PARTS, type FocusKind, type ReadingPart } from '../readingRoutes';

interface ApplicationsChapterProps {
  degDatasetId: string;
  comparisonName: string;
  access: ModuleAccess;
  onOpenFocus: (kind: FocusKind) => void;
}

type ApplicationPartId = Extract<ReadingPart, 'targets' | 'skin' | 'signature'>;

/** Le titre d'une sous-partie : celui du menu, pour qu'ils ne divergent pas. */
const partLabel = (part: ApplicationPartId): string =>
  READING_PARTS.find((p) => p.id === part)?.label ?? part;

function Loading() {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-body-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      Loading…
    </div>
  );
}

/** Un état sans figure : un titre et une phrase, sans niveau de titre de plus dans la page. */
function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-md space-y-1 py-6">
      <p className="text-body-sm font-medium text-primary">{title}</p>
      <p className="text-body-sm text-secondary">{children}</p>
    </div>
  );
}

/**
 * Une sous-partie : sa section (l'`id` du menu et des fragments), son titre en `h3` nommé d'après
 * `READING_PARTS`, et son bouton d'agrandissement à droite.
 */
function ApplicationPart({
  part,
  action,
  children,
}: {
  part: ApplicationPartId;
  action: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section
      id={partDomId(part)}
      aria-labelledby={headingId}
      className="scroll-mt-[calc(var(--sticky-top)+1rem)] space-y-4 py-6 first:pt-0 last:pb-0"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={headingId} className="text-title text-primary">
          {partLabel(part)}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

interface GateProps {
  /** Le drapeau du module dans `ModuleAccess`. */
  unlocked: boolean;
  /** Le profil est arrivé : avant, ni verrou ni contenu. */
  loaded: boolean;
  module: ModuleId;
  copy: { title: string; body: string };
  children: ReactNode;
}

/**
 * Le verrou d'une sous-partie. Sans le module, `LockedPart` prend la place du contenu, qui n'est
 * donc ni monté ni demandé au serveur, même flouté. Tant que le profil n'est pas arrivé
 * (`useModuleAccess` rend tout `false`), un état neutre : un verrou affiché à quelqu'un qui a le
 * module serait faux (même convention que la vue agrandie).
 */
function Gate({ unlocked, loaded, module, copy, children }: GateProps) {
  if (unlocked) return <>{children}</>;
  if (!loaded) return <Loading />;
  return <LockedPart module={module} title={copy.title} body={copy.body} />;
}

/** Le bouton d'agrandissement d'une sous-partie, présent seulement quand le module l'est. */
function openAction(unlocked: boolean, label: string, onClick: () => void): ReactNode {
  if (!unlocked) return null;
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}

/**
 * La nova et la fiche de l'allégation choisie. Séparée pour que l'état du choix (et l'id de la
 * légende) n'existe que quand il y a une nova à montrer.
 *
 * L'allégation ouverte est la première (la plus forte) tant que le lecteur n'en choisit pas une
 * autre, comme dans `CosmOmicsNovaView` ; un nom choisi qui a disparu des données retombe sur la
 * première. La nova garde la charte CosmOmics sur son propre papier clair (`nova-paper`).
 */
function SkinNova({ data, seed }: { data: CosmOmicsNovaData; seed: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const hatchId = `nova-legend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const selected = data.claims.find((claim) => claim.name === picked) ?? data.claims[0];

  return (
    <div className="space-y-4">
      <NovaClaimList claims={data.claims} selected={selected.name} onSelect={setPicked} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <figure className="nova-paper m-0 min-w-0 rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] p-2 sm:p-4">
          <CosmOmicsNova
            data={data}
            seed={seed}
            selectedClaim={selected.name}
            onSelectClaim={setPicked}
          />
          <figcaption className="sr-only">
            One sector per claim, width proportional to its importance; bubbles are pathway sub-groups,
            further out is more significant. The evidence table lists every value.
          </figcaption>
        </figure>
        <aside
          className="nova-paper rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] p-4"
          aria-live="polite"
          aria-label="Claim details"
        >
          <NovaClaimCard claim={selected} />
        </aside>
      </div>
      <div className="nova-paper rounded-card border border-[var(--nova-line)] bg-[var(--nova-paper)] px-4 py-3">
        <NovaLegend hatchId={hatchId} />
      </div>
    </div>
  );
}

function TargetsPart({ access, onOpenFocus }: { access: ModuleAccess; onOpenFocus: (kind: FocusKind) => void }) {
  return (
    <ApplicationPart part="targets" action={openAction(access.targets, 'Rank targets', () => onOpenFocus('targets'))}>
      <Gate
        unlocked={access.targets}
        loaded={access.loaded}
        module="drugdiscovery"
        copy={LOCKED_COPY.targets}
      >
        <p className="text-body-sm text-secondary">Ranks the genes that move here by how druggable they are.</p>
      </Gate>
    </ApplicationPart>
  );
}

function SkinPart({
  degDatasetId,
  comparisonName,
  access,
  onOpenFocus,
}: Pick<ApplicationsChapterProps, 'degDatasetId' | 'comparisonName' | 'access' | 'onOpenFocus'>) {
  // `enabled` suit le verrou : sans le module, rien n'est demandé au serveur.
  const { data, isLoading, error } = useCosmOmicsNova(degDatasetId, comparisonName, access.skin);

  let body: ReactNode;
  if (isLoading) {
    body = <Loading />;
  } else if (error || !data) {
    body = (
      <Note title="No CosmOmics results">
        The nova could not be computed for this comparison. Make sure functional enrichment has been run.
      </Note>
    );
  } else if (data.status === 'no_enrichment') {
    body = (
      <Note title="No enrichment results for this comparison">
        No enrichment of the up- or down-regulated genes is stored for it, so there is nothing to map onto the
        claims. Run functional enrichment for this comparison first.
      </Note>
    );
  } else if (!data.claims.length) {
    const n = data.coverage?.n_terms_significant ?? 0;
    body = (
      <Note title="No claim has a significant pathway">
        {n} enriched term{n === 1 ? '' : 's'} at adjusted p &lt; {data.alpha ?? 0.05}, none of them in the claim
        referential for this comparison.
      </Note>
    );
  } else {
    body = <SkinNova data={data} seed={`${degDatasetId}|${comparisonName}`} />;
  }

  return (
    <ApplicationPart part="skin" action={openAction(access.skin, 'Evidence table', () => onOpenFocus('claims'))}>
      <Gate unlocked={access.skin} loaded={access.loaded} module="claim" copy={LOCKED_COPY.claims}>
        {body}
      </Gate>
    </ApplicationPart>
  );
}

function SignaturePart({ access, onOpenFocus }: { access: ModuleAccess; onOpenFocus: (kind: FocusKind) => void }) {
  return (
    <ApplicationPart
      part="signature"
      action={openAction(access.science, 'Score samples', () => onOpenFocus('signature'))}
    >
      <Gate unlocked={access.science} loaded={access.loaded} module="science" copy={LOCKED_COPY.signature}>
        <p className="text-body-sm text-secondary">
          Scores every sample of the study against a gene list you choose.
        </p>
      </Gate>
    </ApplicationPart>
  );
}

/**
 * Chapitre 5, « What can you apply it to? » : trois applications, chacune derrière son module.
 *
 * - **Drug targets** (`access.targets`) : une phrase et `Rank targets`.
 * - **Skin claims** (`access.skin`) : la nova CosmOmics existante, la rangée des allégations, la
 *   fiche de celle qu'on a choisie et la légende ; `Evidence table` ouvre la table.
 * - **Signature score** (`access.science`) : une phrase et `Score samples`.
 *
 * **Le verrou est la règle de ce fichier.** Sans le module la sous-partie rend `LockedPart` à la
 * place de son contenu : la nova n'est ni demandée (`useCosmOmicsNova` reçoit `enabled = false`)
 * ni rendue, même floutée, et le bouton d'agrandissement n'existe pas. Tant que le profil n'est
 * pas arrivé, un `Loading…` neutre, jamais un verrou.
 */
export default function ApplicationsChapter({
  degDatasetId,
  comparisonName,
  access,
  onOpenFocus,
}: ApplicationsChapterProps) {
  return (
    <ReadingChapter part="applications" number={5} title="What can you apply it to?">
      <div className="divide-y divide-line">
        <TargetsPart access={access} onOpenFocus={onOpenFocus} />
        <SkinPart
          degDatasetId={degDatasetId}
          comparisonName={comparisonName}
          access={access}
          onOpenFocus={onOpenFocus}
        />
        <SignaturePart access={access} onOpenFocus={onOpenFocus} />
      </div>
    </ReadingChapter>
  );
}
