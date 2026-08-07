'use client';

/**
 * Le rapport, rendu tel que genolens-dd le produit.
 *
 * L'endpoint amont préfère échouer en 500 plutôt que de rendre un rapport non cité : un
 * rapport partiellement cité est plus dangereux qu'aucun rapport, parce qu'il a l'air complet.
 * Ce composant respecte le même contrat — aucun claim n'est affiché sans ses renvois.
 *
 * Les renvois de citation visent l'annexe des preuves (`appendix`), jamais la bibliographie
 * (`bibliography`) : `bibliography()` (genolens-dd, report/ir.py) est dédupliquée par SOURCE —
 * plusieurs `evidence_ids` peuvent y partager une seule entrée — elle n'est donc pas adressable
 * par `evidence_id`. Seule `appendix()` porte une ligne par identifiant cité, au format
 * `"[id] kind — subject (...)"` : c'est elle qui sert de cible de renvoi, et elle reste toujours
 * visible (jamais repliée) puisqu'un renvoi vers du contenu masqué serait un renvoi cassé pour
 * l'utilisateur.
 *
 * `n_targets_without_evidence` est affiché dès qu'il dépasse 0 : sinon l'utilisateur croit lire
 * le top 10 du classement alors que des cibles en ont été écartées.
 */
import { DdReport } from '@/types/drugDiscovery';

interface ReportViewProps {
  report: DdReport;
}

const APPENDIX_ENTRY_ID = /^\[([^\]]+)\]/;

function refId(evidenceId: string): string {
  return `ref-${evidenceId}`;
}

/**
 * Extrait l'evidence_id d'une entrée d'annexe (`"[ev-1] ..."`), ou `null` si l'entrée ne
 * respecte pas ce format. On ne fabrique jamais une ancre au hasard : une entrée qui ne matche
 * pas reste affichée mais n'est la cible d'aucun renvoi.
 */
function appendixEvidenceId(entry: string): string | null {
  const match = APPENDIX_ENTRY_ID.exec(entry);
  return match ? match[1] : null;
}

export default function ReportView({ report }: ReportViewProps) {
  const citableEvidenceIds = new Set(
    report.appendix.map(appendixEvidenceId).filter((id): id is string => id !== null)
  );

  return (
    <article className="space-y-8">
      {report.n_targets_without_evidence > 0 && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          {report.n_targets_without_evidence} top-ranked targets were excluded from this report
          for lack of citable evidence. This is therefore not the actual top of the ranking.
        </p>
      )}

      {report.sections.map((section) => (
        <section key={section.title}>
          <h3 className="mb-2 text-lg font-medium text-gray-900">{section.title}</h3>
          <ul className="space-y-2">
            {section.claims.map((claim) => (
              <li key={claim.text} className="text-sm text-gray-800">
                {claim.text}{' '}
                {claim.evidence_ids
                  .filter((id) => citableEvidenceIds.has(id))
                  .map((id) => (
                    <sup key={id} className="ml-0.5">
                      <a href={`#${refId(id)}`} className="text-brand-primary underline">
                        {id}
                      </a>
                    </sup>
                  ))}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <h3 className="mb-2 text-lg font-medium text-gray-900">Evidence</h3>
        <ol className="space-y-1 text-sm text-gray-700">
          {report.appendix.map((entry) => {
            const evidenceId = appendixEvidenceId(entry);
            return (
              <li key={entry} id={evidenceId ? refId(evidenceId) : undefined}>
                {entry}
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h3 className="mb-2 text-lg font-medium text-gray-900">Sources</h3>
        <ul className="space-y-1 text-sm text-gray-700">
          {report.bibliography.map((entry) => (
            <li key={entry}>{entry}</li>
          ))}
        </ul>
      </section>

      <footer className="border-t border-gray-200 pt-4 text-xs text-gray-500">
        <p className="mb-1 font-medium">Attributions</p>
        <ul className="space-y-0.5">
          {report.attributions.map((attribution) => (
            <li key={attribution}>{attribution}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
