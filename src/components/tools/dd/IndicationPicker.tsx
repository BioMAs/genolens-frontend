'use client';

/**
 * Choix de l'indication.
 *
 * Les indications exclues de l'axe maladie sont désactivées et portent leur motif curé en
 * clair. Elles restent atteignables par une échappatoire explicite, parce que genolens-dd
 * expose `allow_excluded` à dessein — mais un run forcé ne porte AUCUN axe maladie, donc la
 * confirmation répète le motif plutôt que de demander un oui générique.
 */
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { DdIndication } from '@/types/drugDiscovery';

interface IndicationPickerProps {
  indications: DdIndication[];
  value: string | null;
  onSelect: (tcgaProject: string) => void;
  onForceExcluded: (tcgaProject: string) => void;
}

export default function IndicationPicker({
  indications,
  value,
  onSelect,
  onForceExcluded,
}: IndicationPickerProps) {
  const [pendingForce, setPendingForce] = useState<DdIndication | null>(null);

  return (
    <div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {indications.map((indication) => (
          <li key={indication.tcga_project}>
            <button
              type="button"
              disabled={indication.excluded}
              onClick={() => onSelect(indication.tcga_project)}
              className={`w-full rounded-lg border p-3 text-left text-sm ${
                value === indication.tcga_project
                  ? 'border-brand-primary bg-indigo-50'
                  : 'border-gray-200 bg-white'
              } ${indication.excluded ? 'cursor-not-allowed opacity-60' : 'hover:shadow-sm'}`}
            >
              <span className="block font-medium text-gray-900">{indication.disease_name}</span>
              <span className="block text-xs text-gray-500">{indication.tcga_project}</span>
            </button>

            {indication.excluded && (
              <div className="mt-1 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                <p>{indication.rationale}</p>
                <button
                  type="button"
                  onClick={() => setPendingForce(indication)}
                  className="mt-1 underline"
                >
                  Lancer sans axe maladie ({indication.tcga_project})
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {pendingForce && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {pendingForce.tcga_project} — classement sans axe maladie
                </h2>
                <p className="mt-2 text-sm text-gray-700">{pendingForce.rationale}</p>
                <p className="mt-2 text-sm text-gray-700">
                  Le classement ne portera que sécurité, dépendance, tractabilité et nouveauté.
                  Il sera indication-agnostique et ne doit pas être lu comme spécifique à cette
                  maladie.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingForce(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  onForceExcluded(pendingForce.tcga_project);
                  setPendingForce(null);
                }}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white"
              >
                Je comprends, lancer quand même
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
