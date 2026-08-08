'use client';

/**
 * Ce qui n'a PAS été analysé, nommé.
 *
 * Trois listes, et les garder distinctes est le point du composant. Elles se ressemblent — des
 * noms de gènes que l'utilisateur a déposés et qui ne figurent pas dans le résultat — mais elles
 * appellent trois actions différentes :
 *
 * - `unresolved` : le symbole n'existe pas dans la carte d'identifiants. Action : vérifier le
 *   fichier source (colonne, espèce, identifiants de sonde).
 * - `corrected` : le symbole a été abîmé par un tableur et a pu être récupéré. Action : réparer
 *   le fichier source, sinon le problème revient au prochain dépôt.
 * - `outside_universe` : le gène existe et a été résolu, mais le classement l'écarte (plancher de
 *   sécurité, essentiel commun, axe requis manquant). Action : aucune — c'est un résultat.
 *
 * Les fondre en un seul compteur ferait donner le mauvais conseil, et un compteur sans noms est
 * ce que le module amont interdit explicitement : « écarter silencieusement 300 des 2 000 DEG
 * d'un client et livrer un rapport sur le reste » est l'erreur qui met fin à une prestation.
 */
import { useState } from 'react';

import { DdSignatureResult } from '@/types/drugDiscovery';

interface SignatureDisclosuresProps {
  result: DdSignatureResult;
}

function GeneList({
  label,
  hint,
  genes,
}: {
  label: string;
  hint: string;
  genes: string[];
}) {
  const [open, setOpen] = useState(false);
  if (genes.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-baseline justify-between text-left"
      >
        <span className="text-sm font-medium text-gray-900">
          {label} ({genes.length})
        </span>
        <span className="text-xs text-brand-primary underline">
          {open ? 'Hide' : 'Show the genes'}
        </span>
      </button>
      <p className="mt-1 text-xs text-gray-500">{hint}</p>
      {open && (
        <p className="mt-2 break-words font-mono text-xs text-gray-700">{genes.join(', ')}</p>
      )}
    </div>
  );
}

export default function SignatureDisclosures({ result }: SignatureDisclosuresProps) {
  const hasAnything =
    result.disclosures.length > 0
    || result.unresolved.length > 0
    || result.corrected.length > 0
    || result.outside_universe.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="space-y-3">
      {result.disclosures.length > 0 && (
        <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 p-4 pl-8 text-sm text-amber-900">
          {result.disclosures.map((disclosure) => (
            <li key={disclosure}>{disclosure}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <GeneList
          label="Not resolved"
          hint="No such gene symbol. Check the source file: wrong column, probe IDs, or species."
          genes={result.unresolved}
        />
        <GeneList
          label="Repaired symbols"
          hint="Spreadsheet corruption, recovered here. Your source file is still damaged."
          genes={result.corrected}
        />
        <GeneList
          label="Resolved but not ranked"
          hint="Excluded by the safety floor, the common-essential rule, or a missing required axis. This is a result, not an error."
          genes={result.outside_universe}
        />
      </div>
    </div>
  );
}
