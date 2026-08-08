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
import { useEffect, useRef, useState } from 'react';

import { DdIndication } from '@/types/drugDiscovery';

interface IndicationPickerProps {
  indications: DdIndication[];
  value: string | null;
  onSelect: (tcgaProject: string) => void;
  onForceExcluded: (tcgaProject: string) => void;
  /**
   * `'grid'` (défaut) est la page outil : le choix de l'indication EST la page.
   * `'compact'` est l'onglet d'une comparaison, où une grille de 33 cellules volerait la
   * vedette au reste. La boîte de confirmation d'une indication exclue est identique dans les
   * deux : c'est la partie critique, et une variante l'aurait fait diverger.
   */
  layout?: 'grid' | 'compact';
}

const CONFIRM_DIALOG_TITLE_ID = 'dd-indication-force-dialog-title';

export default function IndicationPicker({
  indications,
  value,
  onSelect,
  onForceExcluded,
  layout = 'grid',
}: IndicationPickerProps) {
  const [pendingForce, setPendingForce] = useState<DdIndication | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const closeDialog = () => {
    setPendingForce(null);
    triggerRef.current?.focus();
  };

  const openDialog = (indication: DdIndication, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setPendingForce(indication);
  };

  useEffect(() => {
    if (!pendingForce) {
      return undefined;
    }

    // Le focus va sur "Annuler" plutôt que sur le bouton de confirmation : une validation
    // par inadvertance (Entrée pressée trop vite) ne doit pas lancer un run forcé.
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeDialog();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [pendingForce]);

  const selected = indications.find((i) => i.tcga_project === value) ?? null;

  return (
    <div>
      {layout === 'compact' ? (
        <div className="text-sm">
          <select
            value={value ?? ''}
            onChange={(event) => onSelect(event.target.value)}
            className="w-full rounded border border-gray-300 p-2"
          >
            <option value="">Choose an indication…</option>
            {indications.map((indication) => (
              <option
                key={indication.tcga_project}
                value={indication.tcga_project}
                disabled={indication.excluded}
              >
                {indication.disease_name} ({indication.tcga_project})
                {indication.excluded ? ' — excluded' : ''}
              </option>
            ))}
          </select>

          {/* Une option désactivée ne peut pas expliquer pourquoi. L'échappatoire reste
              atteignable, mais elle passe par la même confirmation que sur la page outil. */}
          {indications.some((i) => i.excluded) && (
            <details className="mt-2 text-xs text-gray-600">
              <summary className="cursor-pointer">
                Why are some indications unavailable?
              </summary>
              <ul className="mt-2 space-y-2">
                {indications
                  .filter((indication) => indication.excluded)
                  .map((indication) => (
                    <li
                      key={indication.tcga_project}
                      className="rounded-md bg-amber-50 p-2 text-amber-900"
                    >
                      <span className="font-medium">{indication.tcga_project}</span> —{' '}
                      {indication.rationale}
                      <button
                        type="button"
                        onClick={(event) => openDialog(indication, event.currentTarget)}
                        className="ml-1 underline"
                      >
                        Run without disease axis
                      </button>
                    </li>
                  ))}
              </ul>
            </details>
          )}

          {selected?.excluded && (
            <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              {selected.rationale}
            </p>
          )}
        </div>
      ) : (
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
                  onClick={(event) => openDialog(indication, event.currentTarget)}
                  className="mt-1 underline"
                >
                  Run without disease axis ({indication.tcga_project})
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      )}

      {pendingForce && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={CONFIRM_DIALOG_TITLE_ID}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
              <div>
                <h2 id={CONFIRM_DIALOG_TITLE_ID} className="text-lg font-medium text-gray-900">
                  {pendingForce.tcga_project} — ranking without disease axis
                </h2>
                <p className="mt-2 text-sm text-gray-700">{pendingForce.rationale}</p>
                <p className="mt-2 text-sm text-gray-700">
                  The ranking will only cover safety, dependency, tractability, and novelty. It
                  will be indication-agnostic and should not be read as specific to this disease.
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onForceExcluded(pendingForce.tcga_project);
                  closeDialog();
                }}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm text-white"
              >
                I understand, run anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
