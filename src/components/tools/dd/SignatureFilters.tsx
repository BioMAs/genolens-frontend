'use client';

/**
 * Ce qui sera envoyé, réglable, et compté avant de partir.
 *
 * Le composant existe pour une raison précise : montrer le nombre de gènes par bras **avant** que
 * la liste ne quitte le backend. Un run mal réglé coûte alors un coup d'œil, pas une
 * transmission.
 *
 * Les effectifs de réplicats ne sont jamais préremplis d'une valeur inventée. Quand le backend
 * ne les a pas trouvés (comparaison téléversée sans feuille d'échantillons, par exemple), les
 * champs sont vides et obligatoires, et le bouton reste désactivé — la règle SIG005 amont dit
 * pourquoi : « supposer qu'il est suffisant serait la valeur par défaut la plus dangereuse ».
 *
 * `replicates_source` est affiché à côté de chaque champ. « Lu dans la feuille d'échantillons de
 * l'analyse » et « saisi par vous » n'engagent pas la même confiance, et la première a en plus
 * soustrait les échantillons écartés au QC — une nuance qu'on ne peut pas demander à
 * l'utilisateur de deviner.
 */
import { DdSignatureFilters, DdSignaturePreview } from '@/types/drugDiscovery';

interface SignatureFiltersProps {
  filters: DdSignatureFilters;
  onChange: (filters: DdSignatureFilters) => void;
  preview: DdSignaturePreview | undefined;
  isLoading: boolean;
  replicates: Record<string, number | ''>;
  onReplicatesChange: (replicates: Record<string, number | ''>) => void;
  disabled: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  analysis_samplesheet: 'from the analysis samplesheet (QC-removed samples excluded)',
  project_samplesheet: 'from a project samplesheet',
  user: 'entered by you',
  unknown: 'not found — please enter it',
};

export default function SignatureFilters({
  filters,
  onChange,
  preview,
  isLoading,
  replicates,
  onReplicatesChange,
  disabled,
}: SignatureFiltersProps) {
  const set = <K extends keyof DdSignatureFilters>(
    key: K,
    value: DdSignatureFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="block text-gray-700">Max adjusted p-value</span>
          <input
            type="number"
            step="0.005"
            min="0.001"
            max="0.1"
            value={filters.padjMax}
            disabled={disabled}
            onChange={(event) => set('padjMax', Number(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 p-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-700">Min |log2FC|</span>
          <input
            type="number"
            step="0.1"
            min="0"
            max="5"
            value={filters.logfcMin}
            disabled={disabled}
            onChange={(event) => set('logfcMin', Number(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 p-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-700">Directions</span>
          <select
            value={filters.directions}
            disabled={disabled}
            onChange={(event) =>
              set('directions', event.target.value as DdSignatureFilters['directions'])
            }
            className="mt-1 w-full rounded border border-gray-300 p-1.5"
          >
            <option value="both">Up and down</option>
            <option value="up">Up-regulated only</option>
            <option value="down">Down-regulated only</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block text-gray-700">Max genes per arm</span>
          <input
            type="number"
            step="50"
            min="1"
            max="2000"
            value={filters.maxGenesPerCondition}
            disabled={disabled}
            onChange={(event) => set('maxGenesPerCondition', Number(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 p-1.5"
          />
        </label>

        <label className="text-sm">
          <span className="block text-gray-700">
            Seed
            <span
              className="ml-1 cursor-help text-gray-400"
              title="Recorded and shown so the p-value can be reproduced exactly."
            >
              ?
            </span>
          </span>
          <input
            type="number"
            value={filters.seed}
            disabled={disabled}
            onChange={(event) => set('seed', Number(event.target.value))}
            className="mt-1 w-full rounded border border-gray-300 p-1.5"
          />
        </label>
      </div>

      {/* Le plafond n'est pas décoratif : au-delà de ~20 % de l'univers classé, le percentile
          moyen dégénère vers 0,5 et le test cesse de discriminer. */}
      {filters.maxGenesPerCondition > 1500 && (
        <p className="text-xs text-amber-800">
          Above ~1500 genes per arm the mean-percentile statistic loses discriminating power: the
          signature starts to cover a large share of the ~15,000 ranked genes.
        </p>
      )}

      <div>
        <h4 className="text-sm font-medium text-gray-900">What will be sent</h4>
        {isLoading && <p className="mt-1 text-sm text-gray-500">Counting genes…</p>}
        {!isLoading && preview && preview.conditions.length === 0 && (
          <p className="mt-1 text-sm text-gray-600">
            No gene passes these thresholds. Loosen padj or |log2FC|.
          </p>
        )}
        {!isLoading && preview && preview.conditions.length > 0 && (
          <ul className="mt-2 space-y-3">
            {preview.conditions.map((condition) => (
              <li key={condition.name} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium text-gray-900">{condition.name}</span>
                  <span
                    className={
                      condition.direction === 'UP'
                        ? 'text-xs font-medium text-red-600'
                        : 'text-xs font-medium text-blue-600'
                    }
                  >
                    {condition.direction}
                  </span>
                  <span className="text-gray-600">
                    {condition.n_genes} gene{condition.n_genes === 1 ? '' : 's'}
                    {condition.truncated && (
                      <span className="ml-1 text-amber-800">
                        (capped from {condition.n_available} — the most significant were kept)
                      </span>
                    )}
                  </span>
                </div>
                <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                  <span>Replicates</span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={replicates[condition.name] ?? ''}
                    disabled={disabled}
                    onChange={(event) =>
                      onReplicatesChange({
                        ...replicates,
                        [condition.name]:
                          event.target.value === '' ? '' : Number(event.target.value),
                      })
                    }
                    className={`w-20 rounded border p-1 ${
                      replicates[condition.name] === '' || replicates[condition.name] === undefined
                        ? 'border-amber-400 bg-amber-50'
                        : 'border-gray-300'
                    }`}
                  />
                  <span className="text-gray-500">
                    {SOURCE_LABEL[condition.replicates_source] ?? condition.replicates_source}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {!isLoading && preview && preview.warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-800">
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
