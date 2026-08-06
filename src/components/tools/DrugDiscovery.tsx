'use client';

/**
 * Racine du module Drug Discovery.
 *
 * L'URL porte les PARAMÈTRES du run, jamais le `run_id` : genolens-dd garde ses runs en
 * mémoire, donc un lien vers un identifiant casserait au premier redéploiement. Un lien vers
 * les paramètres relance le calcul et fonctionne toujours.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import IndicationPicker from '@/components/tools/dd/IndicationPicker';
import ProfileSelector from '@/components/tools/dd/ProfileSelector';
import ReportView from '@/components/tools/dd/ReportView';
import TargetTable from '@/components/tools/dd/TargetTable';
import {
  useDdStatus,
  useDdTargetsWithRecovery,
  useDdRun,
  useIndications,
  useReport,
  useRunDetail,
} from '@/hooks/useDrugDiscovery';
import { useUserProfile } from '@/hooks/useUserProfile';
import { DdRunParams } from '@/types/drugDiscovery';
import { canUseAI } from '@/utils/plan';

const DEFAULT_PROFILE = 'default_oncology';

export default function DrugDiscovery() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useUserProfile();
  const [tab, setTab] = useState<'targets' | 'report'>('targets');
  const [limit, setLimit] = useState(50);

  const allowed = canUseAI(profile.data);

  // Les trois scalaires sont lus SÉPARÉMENT de `params`. Les dériver de `params` rendrait le
  // profil inaccessible tant qu'aucune indication n'est choisie, et un profil sélectionné en
  // premier serait silencieusement perdu.
  const selectedIndication = searchParams.get('indication');
  const selectedProfile = searchParams.get('profile') ?? DEFAULT_PROFILE;
  const selectedAllowExcluded = searchParams.get('allow_excluded') === '1';

  const params: DdRunParams | null = useMemo(
    () =>
      !selectedIndication || !allowed
        ? null
        : {
            indication: selectedIndication,
            profile: selectedProfile,
            allowExcluded: selectedAllowExcluded,
          },
    [allowed, selectedAllowExcluded, selectedIndication, selectedProfile],
  );

  const setParams = useCallback(
    (next: { indication?: string; profile?: string; allowExcluded?: boolean }) => {
      const query = new URLSearchParams();
      const indication = next.indication ?? selectedIndication;
      if (indication) query.set('indication', indication);
      query.set('profile', next.profile ?? selectedProfile);
      if (next.allowExcluded ?? (next.indication ? false : selectedAllowExcluded)) {
        query.set('allow_excluded', '1');
      }
      router.replace(`/tools/drug-discovery?${query.toString()}`);
    },
    [router, selectedAllowExcluded, selectedIndication, selectedProfile],
  );

  const status = useDdStatus(allowed);
  const catalogue = useIndications(allowed);
  const run = useDdRun(params);
  const detail = useRunDetail(run.data);
  const targets = useDdTargetsWithRecovery(params, limit);
  const report = useReport(run.data);

  if (profile.isLoading) {
    return <p className="text-sm text-gray-500">Chargement…</p>;
  }

  if (!allowed) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <h2 className="text-xl font-medium text-gray-900">
          Drug Discovery nécessite un plan TEAM ou ON_PREMISE
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
          Le module classe des cibles thérapeutiques sur 33 indications TCGA à partir de sources
          publiques curées, et produit un rapport cité pour les meilleures.
        </p>
        <a
          href="/pricing"
          className="mt-4 inline-block rounded-md bg-brand-primary px-4 py-2 text-sm text-white"
        >
          Voir les plans
        </a>
      </div>
    );
  }

  if (status.data && (!status.data.configured || status.data.reachable === false)) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        {!status.data.configured
          ? "Drug Discovery n'est pas configuré sur ce serveur. Contactez un administrateur."
          : 'Le service Drug Discovery est momentanément injoignable. Réessayez dans un instant.'}
      </div>
    );
  }

  /**
   * `GET /status` et `GET /indications` sont les deux PREMIERS appels de chaque chargement de
   * page — leur mode de défaillance le plus probable (502/503/504, timeout réseau) n'a pas de
   * `data`, donc le garde-fou ci-dessus ne se déclenche jamais : sans ce bloc, la section
   * catalogue s'afficherait vide, sans message ni indicateur.
   */
  if (status.error || catalogue.error) {
    const bootstrapFailure = (status.error ?? catalogue.error) as
      | { response?: { status?: number } }
      | undefined;
    const notConfigured = bootstrapFailure?.response?.status === 503;
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        <p>
          {notConfigured
            ? "Drug Discovery n'est pas configuré sur ce serveur. Contactez un administrateur."
            : 'Drug Discovery est momentanément indisponible. Réessayez dans un instant.'}
        </p>
        <button
          type="button"
          onClick={() => {
            if (status.error) void status.refetch();
            if (catalogue.error) void catalogue.refetch();
          }}
          className="mt-2 underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  /**
   * Un 422 porte la rationale curée et s'affiche VERBATIM : c'est la seule partie actionnable
   * de la réponse. Les autres échecs n'ont rien d'actionnable côté utilisateur, mais les taire
   * laisserait la page bloquée sur « Calcul en cours… » sans jamais rien rendre.
   */
  const failure = (run.error ?? targets.error ?? report.error) as
    | { response?: { status?: number; data?: { detail?: string } } }
    | undefined;
  const failureStatus = failure?.response?.status;
  const rejection = failureStatus === 422 ? failure?.response?.data?.detail : null;
  const outage =
    failureStatus === undefined || failureStatus === 422 || failureStatus === 404
      ? null
      : failureStatus === 503
        ? "Drug Discovery n'est pas configuré sur ce serveur. Contactez un administrateur."
        : failureStatus === 504
          ? 'Le calcul a dépassé le délai autorisé. Réessayez.'
          : failureStatus === 403
            ? 'Votre plan ne donne pas accès à Drug Discovery.'
            : 'Drug Discovery est momentanément indisponible. Réessayez dans un instant.';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        {catalogue.isLoading && <p className="text-sm text-gray-500">Chargement du catalogue…</p>}
        {catalogue.data && (
          <div className="space-y-4">
            <ProfileSelector
              profiles={catalogue.data.profiles}
              value={selectedProfile}
              onChange={(next) => setParams({ profile: next })}
            />
            <IndicationPicker
              indications={catalogue.data.indications}
              value={selectedIndication}
              onSelect={(indication) => setParams({ indication })}
              onForceExcluded={(indication) => setParams({ indication, allowExcluded: true })}
            />
          </div>
        )}
      </section>

      {rejection && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{rejection}</p>
      )}

      {outage && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">
          <p>{outage}</p>
          <button
            type="button"
            onClick={() => {
              void run.refetch();
              void targets.refetch();
              void report.refetch();
            }}
            className="mt-2 underline"
          >
            Réessayer
          </button>
        </div>
      )}

      {detail.data?.warnings.map((warning) => (
        <p key={warning} className="rounded-md bg-amber-100 p-3 text-sm font-medium text-amber-900">
          {warning}
        </p>
      ))}

      {params && (
        <>
          <div className="flex gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setTab('targets')}
              className={`px-4 py-2 text-sm ${tab === 'targets' ? 'border-b-2 border-brand-primary font-medium' : 'text-gray-500'}`}
            >
              Cibles
            </button>
            <button
              type="button"
              onClick={() => setTab('report')}
              className={`px-4 py-2 text-sm ${tab === 'report' ? 'border-b-2 border-brand-primary font-medium' : 'text-gray-500'}`}
            >
              Rapport
            </button>
          </div>

          {tab === 'targets' && targets.data && (
            <TargetTable
              data={targets.data}
              weights={detail.data?.weights ?? {}}
              limit={limit}
              onLimitChange={setLimit}
            />
          )}
          {tab === 'report' && report.data && <ReportView report={report.data} />}
          {(targets.isLoading || report.isLoading) && (
            <p className="text-sm text-gray-500">Calcul en cours…</p>
          )}
        </>
      )}
    </div>
  );
}
