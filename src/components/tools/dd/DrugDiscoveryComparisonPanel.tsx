'use client';

/**
 * Onglet « Drug targets » d'une comparaison : la signature de l'utilisateur face au classement.
 *
 * Ce que ce panneau garantit, et qui ne se voit pas dans le rendu :
 *
 * **Rien ne part avant un clic.** `submitted` reste `null` jusqu'à ce que l'utilisateur presse
 * Run. Le mode A déclenche son calcul dès qu'une URL porte des paramètres, parce qu'il ne lit que
 * des données publiques ; ici un run envoie la liste de gènes de l'utilisateur à un autre
 * service, et un calcul spéculatif serait une transmission qu'il n'a pas demandée. Le preview,
 * lui, est local au backend et peut tourner librement.
 *
 * **L'état n'est pas dans l'URL.** Le mode A y met ses paramètres parce que la page *est* le run.
 * Ici la page possède déjà `?datasetId=` et son onglet ; un second propriétaire d'état dans la
 * query string inviterait les conflits. La graine et les seuils sont affichés à la place, ce qui
 * rend un run reproductible à la main.
 *
 * **Une indication est obligatoire.** Le tirage nul est apparié sur les déciles d'expression
 * tumorale, qui sont propres à un projet TCGA : genolens-dd refuse un run pan-cancer plutôt que
 * de retomber sur un tirage uniforme étiqueté « apparié ». Il n'y a donc pas d'option
 * pan-cancer ici, contrairement à la page outil.
 */
import { useMemo, useState } from 'react';

import IndicationPicker from '@/components/tools/dd/IndicationPicker';
import ProfileSelector from '@/components/tools/dd/ProfileSelector';
import ReportView from '@/components/tools/dd/ReportView';
import SignatureDisclosures from '@/components/tools/dd/SignatureDisclosures';
import SignatureFilters from '@/components/tools/dd/SignatureFilters';
import SignatureHitsTable from '@/components/tools/dd/SignatureHitsTable';
import {
  SIGNATURE_RULES,
  parseSignatureRejection,
} from '@/components/tools/dd/signatureRules';
import {
  useDdStatus,
  useIndications,
  useRunDetail,
  useSignaturePreview,
  useSignatureReport,
  useSignatureRunWithRecovery,
} from '@/hooks/useDrugDiscovery';
import { useUserProfile } from '@/hooks/useUserProfile';
import {
  DdSignatureFilters,
  DdSignatureRunParams,
} from '@/types/drugDiscovery';
import { isPrivilegedRole } from '@/utils/plan';
import { useModuleAccessRequest } from '@/hooks/useModuleAccessRequest';

const DEFAULT_PROFILE = 'default_oncology';

const DEFAULT_FILTERS: DdSignatureFilters = {
  padjMax: 0.05,
  logfcMin: 1.0,
  directions: 'both',
  maxGenesPerCondition: 1000,
  seed: 1234,
};

interface DrugDiscoveryComparisonPanelProps {
  datasetId: string;
  comparisonName: string;
}

export default function DrugDiscoveryComparisonPanel({
  datasetId,
  comparisonName,
}: DrugDiscoveryComparisonPanelProps) {
  const profile = useUserProfile();
  // Per-user add-on, independent of the plan (see require_drug_discovery_access).
  const allowed =
    isPrivilegedRole(profile.data?.role) || profile.data?.has_drug_discovery_module === true;
  const {
    request: requestAccess,
    pending: accessPending,
    notice: accessNotice,
    requested: accessRequested,
  } = useModuleAccessRequest();

  const [filters, setFilters] = useState<DdSignatureFilters>(DEFAULT_FILTERS);
  const [indication, setIndication] = useState<string | null>(null);
  const [allowExcluded, setAllowExcluded] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(DEFAULT_PROFILE);
  const [replicates, setReplicates] = useState<Record<string, number | ''>>({});
  const [allowUnderpowered, setAllowUnderpowered] = useState(false);
  const [submitted, setSubmitted] = useState<DdSignatureRunParams | null>(null);
  const [tab, setTab] = useState<'targets' | 'report'>('targets');

  const status = useDdStatus(allowed);
  const catalogue = useIndications(allowed);

  const preview = useSignaturePreview(
    allowed
      ? {
          datasetId,
          comparisonName,
          padjMax: filters.padjMax,
          logfcMin: filters.logfcMin,
          directions: filters.directions,
          maxGenesPerCondition: filters.maxGenesPerCondition,
        }
      : null,
  );

  // Les effectifs lus par le backend préremplissent les champs, sans écraser une saisie en
  // cours : `replicates` prime dès que l'utilisateur a touché un champ.
  const effectiveReplicates = useMemo(() => {
    const merged: Record<string, number | ''> = {};
    (preview.data?.conditions ?? []).forEach((condition) => {
      merged[condition.name] =
        replicates[condition.name] !== undefined
          ? replicates[condition.name]
          : (condition.replicates ?? '');
    });
    return merged;
  }, [preview.data, replicates]);

  const conditions = preview.data?.conditions ?? [];
  const replicatesComplete =
    conditions.length > 0
    && conditions.every((condition) => {
      const value = effectiveReplicates[condition.name];
      return typeof value === 'number' && value >= 1;
    });

  const canRun = Boolean(indication) && replicatesComplete && !preview.isFetching;

  const runQuery = useSignatureRunWithRecovery(submitted);
  const result = runQuery.data?.result;
  const detail = useRunDetail(runQuery.data?.run_id);
  // Le rapport est l'appel le plus cher en amont : ne le déclencher que si l'onglet est ouvert.
  const report = useSignatureReport(
    runQuery.data?.run_id,
    result?.signature_id,
    tab === 'report',
  );

  const rejection = parseSignatureRejection(runQuery.error);

  /**
   * Symbole → direction, construit depuis les listes réellement envoyées.
   *
   * Le backend renvoie `genes` par bras sur la réponse de run précisément pour ça : la direction
   * d'un hit ne se déduit d'aucune autre donnée disponible ici, et l'inférer du signe du
   * classement — qui n'a rien à voir — serait une supposition affichée comme un fait.
   */
  const directionBySymbol = useMemo(() => {
    const map: Record<string, 'UP' | 'DOWN'> = {};
    (runQuery.data?.signature.conditions ?? []).forEach((condition) => {
      (condition.genes ?? []).forEach((symbol) => {
        map[symbol] = condition.direction;
      });
    });
    return map;
  }, [runQuery.data]);

  const launch = () => {
    if (!indication || !replicatesComplete) return;
    setSubmitted({
      ...filters,
      datasetId,
      comparisonName,
      indication,
      profile: selectedProfile,
      allowExcluded,
      allowUnderpowered,
      replicates: Object.fromEntries(
        Object.entries(effectiveReplicates).filter(
          (entry): entry is [string, number] => typeof entry[1] === 'number',
        ),
      ),
    });
    setTab('targets');
  };

  if (profile.isLoading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!allowed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h3 className="text-lg font-medium text-gray-900">
          Drug targets is an add-on module
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
          Confront this comparison&apos;s differentially expressed genes with a ranking of
          therapeutic targets across 33 TCGA indications, and get a cited report on the hits.
        </p>
        <button
          type="button"
          onClick={() => requestAccess('drugdiscovery')}
          disabled={accessPending === 'drugdiscovery' || accessRequested.includes('drugdiscovery')}
          className="mt-4 inline-block rounded-md bg-brand-primary px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {accessRequested.includes('drugdiscovery')
            ? 'Request sent'
            : accessPending === 'drugdiscovery'
              ? 'Sending…'
              : 'Request access'}
        </button>
        {accessNotice && (
          <p
            className={`mt-2 text-sm ${accessNotice.kind === 'success' ? 'text-green-700' : 'text-red-700'}`}
          >
            {accessNotice.text}
          </p>
        )}
      </div>
    );
  }

  if (status.data && !status.data.configured) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        Drug Discovery is not configured on this server. Contact an administrator.
      </div>
    );
  }

  if (status.data && status.data.reachable === false) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        Drug Discovery is temporarily unreachable. Try again in a moment.
      </div>
    );
  }

  if (status.data && status.data.reachable && status.data.ready === false) {
    return (
      <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
        Drug Discovery is reachable, but its reference dataset is incomplete. Contact an
        administrator.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Sends this comparison&apos;s gene symbols to the Drug Discovery service and reports which
        of them are well-ranked therapeutic targets for the indication you choose, with an
        expression-matched permutation p-value. Only gene symbols and replicate counts are sent —
        no expression values.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-sm font-medium text-gray-900">Indication</h4>
          {catalogue.data ? (
            <IndicationPicker
              layout="compact"
              indications={catalogue.data.indications}
              value={indication}
              onSelect={(project) => {
                setIndication(project || null);
                setAllowExcluded(false);
              }}
              onForceExcluded={(project) => {
                setIndication(project);
                setAllowExcluded(true);
              }}
            />
          ) : (
            <p className="text-sm text-gray-500">Loading indications…</p>
          )}
        </div>
        <div>
          {catalogue.data && (
            <ProfileSelector
              profiles={catalogue.data.profiles}
              value={selectedProfile}
              onChange={setSelectedProfile}
            />
          )}
        </div>
      </div>

      <SignatureFilters
        filters={filters}
        onChange={setFilters}
        preview={preview.data}
        isLoading={preview.isLoading}
        replicates={effectiveReplicates}
        onReplicatesChange={setReplicates}
        disabled={runQuery.isFetching}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={launch}
          disabled={!canRun || runQuery.isFetching}
          className="rounded-md bg-brand-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {runQuery.isFetching ? 'Running…' : 'Run against the ranking'}
        </button>
        {!indication && (
          <span className="text-xs text-gray-500">Choose an indication first.</span>
        )}
        {indication && !replicatesComplete && (
          <span className="text-xs text-amber-800">
            Enter the replicate count for every arm — it is never guessed.
          </span>
        )}
      </div>

      {rejection && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            {SIGNATURE_RULES[rejection.rule_id]?.title ?? 'Signature refused'}{' '}
            <span className="font-mono text-xs">({rejection.rule_id})</span>
          </p>
          <p className="mt-1">
            {SIGNATURE_RULES[rejection.rule_id]?.explanation ?? rejection.message}
          </p>
          {rejection.conditions.length > 0 && (
            <p className="mt-1 text-xs">
              Affected condition(s): {rejection.conditions.join(', ')}
            </p>
          )}
          {/* Proposé SEULEMENT après un SIG002. SIG001 (un seul réplicat) est inappelable par
              conception, et offrir une case à cocher laisserait croire le contraire. */}
          {SIGNATURE_RULES[rejection.rule_id]?.appealable && (
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allowUnderpowered}
                onChange={(event) => setAllowUnderpowered(event.target.checked)}
              />
              I accept an underpowered signature — results will be marked low-confidence
            </label>
          )}
          {rejection.message && (
            <p className="mt-2 text-xs text-amber-800/80">{rejection.message}</p>
          )}
        </div>
      )}

      {runQuery.isError && !rejection && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
          <p>The run failed. Try again in a moment.</p>
          {runQuery.exhausted && (
            <button
              type="button"
              onClick={runQuery.reset}
              className="mt-2 rounded-md border border-red-300 px-3 py-1"
            >
              Restart the calculation
            </button>
          )}
        </div>
      )}

      {result && runQuery.data && (
        <div className="space-y-4">
          {runQuery.data.signature.warnings.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md bg-amber-50 p-3 pl-8 text-xs text-amber-900">
              {runQuery.data.signature.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <SignatureDisclosures result={result} />

          <div className="flex gap-2 border-b border-gray-200">
            {(['targets', 'report'] as const).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setTab(name)}
                className={`px-3 py-2 text-sm ${
                  tab === name
                    ? 'border-b-2 border-brand-primary font-medium text-gray-900'
                    : 'text-gray-500'
                }`}
              >
                {name === 'targets' ? 'Hits' : 'Report'}
              </button>
            ))}
          </div>

          {tab === 'targets' && (
            <SignatureHitsTable
              result={result}
              weights={detail.data?.weights ?? {}}
              directionBySymbol={directionBySymbol}
              genesSentTotal={runQuery.data.signature.genes_sent_total}
            />
          )}

          {tab === 'report' && (
            <>
              {report.isLoading && <p className="text-sm text-gray-500">Building the report…</p>}
              {report.isError && (
                <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
                  No report can be produced for this signature. This usually means none of your
                  genes is in the ranked universe for this indication.
                </p>
              )}
              {report.data && <ReportView report={report.data} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
