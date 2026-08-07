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

  const status = useDdStatus(allowed);
  const catalogue = useIndications(allowed);

  // `benchmark` n'apparaît jamais dans `catalogue.data.profiles` (genolens-dd le filtre), mais
  // rien n'empêche une URL de le porter (partagée, tapée à la main, ancien lien). Tant que le
  // catalogue n'est pas chargé, on ne peut pas encore valider — retomber sur le défaut évite de
  // POSTer un nom qui pourrait s'avérer invalide.
  const effectiveProfile = useMemo(() => {
    if (!catalogue.data) return DEFAULT_PROFILE;
    return catalogue.data.profiles.includes(selectedProfile) ? selectedProfile : DEFAULT_PROFILE;
  }, [catalogue.data, selectedProfile]);

  const params: DdRunParams | null = useMemo(
    () =>
      !selectedIndication || !allowed || !catalogue.data
        ? null
        : {
            indication: selectedIndication,
            profile: effectiveProfile,
            allowExcluded: selectedAllowExcluded,
          },
    [allowed, catalogue.data, effectiveProfile, selectedAllowExcluded, selectedIndication],
  );

  const setParams = useCallback(
    (next: { indication?: string; profile?: string; allowExcluded?: boolean }) => {
      const query = new URLSearchParams();
      const indication = next.indication ?? selectedIndication;
      if (indication) query.set('indication', indication);
      query.set('profile', next.profile ?? effectiveProfile);
      if (next.allowExcluded ?? (next.indication ? false : selectedAllowExcluded)) {
        query.set('allow_excluded', '1');
      }
      router.replace(`/tools/drug-discovery?${query.toString()}`);
    },
    [router, selectedAllowExcluded, selectedIndication, effectiveProfile],
  );

  const run = useDdRun(params);
  const detail = useRunDetail(run.data);
  const targets = useDdTargetsWithRecovery(params, limit);
  // Le rapport est l'appel le plus cher en amont : ne le déclencher que si l'onglet Rapport est
  // effectivement consulté, pas dès qu'un run existe — sinon un utilisateur qui ne quitte
  // jamais l'onglet Cibles paie quand même le calcul complet du rapport.
  const report = useReport(tab === 'report' ? run.data : undefined);

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

  if (status.data && !status.data.configured) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        Drug Discovery n&apos;est pas configuré sur ce serveur. Contactez un administrateur.
      </div>
    );
  }

  if (status.data && status.data.reachable === false) {
    return (
      <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
        Le service Drug Discovery est momentanément injoignable. Réessayez dans un instant.
      </div>
    );
  }

  /**
   * `/readyz` amont rend 503 avec un corps quand le socle de référence est incomplet — son
   * fonctionnement nominal, pas une panne. Le backend le distingue déjà (`reachable: true,
   * ready: false`) ; ce bloc doit rester séparé des deux ci-dessus pour ne jamais se confondre
   * avec « injoignable » ni avec « non configuré » — le service tourne, il lui manque des
   * données, et `tables` dit lesquelles reconstruire.
   */
  if (status.data && status.data.reachable && status.data.ready === false) {
    const tables = status.data.tables ?? {};
    return (
      <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">
          Drug Discovery est joignable, mais son socle de référence est incomplet.
        </p>
        {Object.keys(tables).length > 0 && (
          <>
            <p className="mt-1">Tables à reconstruire :</p>
            <ul className="mt-1 list-disc pl-5">
              {Object.entries(tables).map(([table, state]) => (
                <li key={table}>
                  {table} — {state}
                </li>
              ))}
            </ul>
          </>
        )}
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
   *
   * Le rapport n'entre PAS dans ce calcul : c'est l'appel le plus cher en amont, et une panne
   * qui lui est propre (504 typiquement) ne doit pas condamner l'affichage d'un tableau de
   * cibles par ailleurs parfaitement rendu. Il a son propre bloc, plus bas, scoping son message
   * et son bouton Réessayer à lui seul.
   */
  const failure = (run.error ?? targets.error) as
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

  const reportFailure = report.error as
    | { response?: { status?: number; data?: { detail?: string } } }
    | undefined;
  const reportFailureStatus = reportFailure?.response?.status;
  const reportRejection = reportFailureStatus === 422 ? reportFailure?.response?.data?.detail : null;
  const reportOutage =
    reportFailureStatus === undefined || reportFailureStatus === 422 || reportFailureStatus === 404
      ? null
      : reportFailureStatus === 503
        ? "Drug Discovery n'est pas configuré sur ce serveur. Contactez un administrateur."
        : reportFailureStatus === 504
          ? 'Le calcul du rapport a dépassé le délai autorisé. Réessayez.'
          : reportFailureStatus === 403
            ? 'Votre plan ne donne pas accès à Drug Discovery.'
            : 'Le rapport est momentanément indisponible. Réessayez dans un instant.';

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        {catalogue.isLoading && <p className="text-sm text-gray-500">Chargement du catalogue…</p>}
        {catalogue.data && (
          <div className="space-y-4">
            <ProfileSelector
              profiles={catalogue.data.profiles}
              value={effectiveProfile}
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

          {targets.exhausted ? (
            /**
             * Borne de récupération épuisée (voir useDdTargetsWithRecovery) : dd a oublié ce
             * run_id une seconde fois, malgré une tentative de récupération. Rien ne se répare
             * tout seul ici — la ref survit au re-rendu, et un rechargement de la page ne change
             * pas le jeu de paramètres dans l'URL. Le bouton réarme explicitement la borne et
             * relance, seule sortie de cette impasse.
             */
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
              <p>
                Le calcul a expiré : le service a oublié ce run avant que la page ait pu le lire.
              </p>
              <button type="button" onClick={targets.reset} className="mt-2 underline">
                Relancer le calcul
              </button>
            </div>
          ) : (
            <>
              {tab === 'targets' && targets.data && (
                <TargetTable
                  data={targets.data}
                  weights={detail.data?.weights ?? {}}
                  limit={limit}
                  onLimitChange={setLimit}
                />
              )}

              {tab === 'report' && (
                <>
                  {reportRejection && (
                    <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                      {reportRejection}
                    </p>
                  )}
                  {reportOutage && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-900">
                      <p>{reportOutage}</p>
                      <button
                        type="button"
                        onClick={() => void report.refetch()}
                        className="mt-2 underline"
                      >
                        Réessayer
                      </button>
                    </div>
                  )}
                  {report.data && <ReportView report={report.data} />}
                </>
              )}

              {((tab === 'targets' && targets.isLoading) ||
                (tab === 'report' && report.isLoading)) && (
                <p className="text-sm text-gray-500">Calcul en cours…</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
