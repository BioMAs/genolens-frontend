/**
 * Hooks du module Drug Discovery.
 *
 * DEUX CHOSES NON ÉVIDENTES, toutes deux imposées par genolens-dd.
 *
 * 1. `useDdRun` est un `useQuery` alors qu'il émet un POST. Un run est une fonction pure de
 *    ses paramètres côté dd — mêmes paramètres, même classement — donc le cacher par
 *    paramètres est correct, et c'est ce qui permet à une URL partagée de déclencher le calcul
 *    sans clic. Le convertir en `useMutation` casserait le partage d'URL.
 *
 * 2. dd garde ses runs EN MÉMOIRE. Un redémarrage du conteneur invalide tous les `run_id`, et
 *    `/targets` rend alors 404. `useDdTargetsWithRecovery` recrée le run — UNE SEULE FOIS par
 *    identifiant perdu, sinon un dd durablement cassé produirait une boucle de POST.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/utils/api';
import {
  DdIndicationsResponse,
  DdReport,
  DdRunDetail,
  DdRunParams,
  DdSignaturePreview,
  DdSignatureRunParams,
  DdSignatureRunResponse,
  DdStatus,
  DdTargetsResponse,
} from '@/types/drugDiscovery';

const BASE = '/drug-discovery';

function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * `enabled` n'est pas décoratif : ces deux requêtes partent au montage, donc avant que la garde
 * de plan n'ait pu rendre son écran. Sur un compte STARTER elles produiraient deux 403 inutiles
 * à chaque visite, et l'écran d'upgrade s'afficherait par-dessus des erreurs réseau.
 */
export function useDdStatus(enabled = true) {
  return useQuery({
    queryKey: ['dd', 'status'],
    queryFn: async () => (await api.get<DdStatus>(`${BASE}/status`)).data,
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useIndications(enabled = true) {
  return useQuery({
    queryKey: ['dd', 'indications'],
    // Table curée : elle ne bouge pas pendant une session.
    queryFn: async () =>
      (await api.get<DdIndicationsResponse>(`${BASE}/indications`)).data,
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function runKey(params: DdRunParams) {
  return ['dd', 'run', params.indication, params.profile, params.allowExcluded] as const;
}

export function useDdRun(params: DdRunParams | null) {
  return useQuery({
    queryKey: params ? runKey(params) : ['dd', 'run', 'idle'],
    queryFn: async () => {
      const body = {
        indication: params!.indication,
        profile: params!.profile,
        allow_excluded: params!.allowExcluded,
      };
      return (await api.post<{ run_id: string }>(`${BASE}/runs`, body)).data.run_id;
    },
    enabled: params !== null,
    staleTime: Infinity,
    retry: false,
  });
}

export function useRunDetail(runId: string | undefined) {
  return useQuery({
    // POST /runs ne rend que le run_id ; les warnings d'un run forcé ne sont ici.
    queryKey: ['dd', 'runDetail', runId],
    queryFn: async () => (await api.get<DdRunDetail>(`${BASE}/runs/${runId}`)).data,
    enabled: Boolean(runId),
    staleTime: Infinity,
    retry: false,
  });
}

export function useTargets(runId: string | undefined, limit: number) {
  return useQuery({
    queryKey: ['dd', 'targets', runId, limit],
    queryFn: async () =>
      (await api.get<DdTargetsResponse>(`${BASE}/runs/${runId}/targets`, {
        params: { limit },
      })).data,
    enabled: Boolean(runId),
    retry: false,
  });
}

export function useReport(runId: string | undefined) {
  return useQuery({
    queryKey: ['dd', 'report', runId],
    queryFn: async () => (await api.get<DdReport>(`${BASE}/runs/${runId}/report`)).data,
    enabled: Boolean(runId),
    retry: false,
  });
}

/**
 * Le classement, avec récupération après expiration du run.
 *
 * Le `Set` des tentatives déjà faites vit dans une ref : il survit aux rendus et ne déclenche
 * pas de re-render. Il est indexé par **jeu de paramètres** (`indication|profile|allowExcluded`,
 * la même clé que `runKey`), PAS par `run_id` : côté genolens-dd, `POST /runs` fait
 * `run_id = str(uuid.uuid4())`, donc chaque appel — même à paramètres identiques — mint un
 * identifiant frais. Borner sur `run_id` ne bornerait jamais rien : la garde ne se
 * déclencherait jamais et un dd durablement cassé produirait une boucle de POST sans fin.
 * Le jeu de paramètres, lui, identifie la demande de l'utilisateur et reste stable d'une
 * tentative à l'autre — c'est la seule borne qui protège réellement.
 *
 * Le déclenchement vit dans un `useEffect` (pas dans le corps du rendu) : `recover()` mute le
 * cache React Query et émet un vrai POST réseau, un effet de bord qui doit attendre le commit.
 * Appelé pendant le rendu, un rendu concurrent abandonné avant commit émettrait quand même le
 * POST.
 */
export function useDdTargetsWithRecovery(params: DdRunParams | null, limit: number) {
  const qc = useQueryClient();
  const retried = useRef<Set<string>>(new Set());
  // Épuisé : exposé comme état, pas dérivé de `retried.current` pendant le rendu — lire un ref
  // hors effet/callback est interdit par les règles des Hooks (`react-hooks/refs`) et, plus
  // concrètement, ne déclencherait aucun nouveau rendu quand la valeur change puisqu'un ref ne
  // notifie jamais React. `recover` est le seul endroit qui l'écrit, et il ne tourne que dans un
  // effet ou dans `reset` (un gestionnaire d'événement) — jamais pendant le rendu.
  const [exhaustedKey, setExhaustedKey] = useState<string | null>(null);
  const run = useDdRun(params);
  const targets = useTargets(run.data, limit);
  const key = params ? runKey(params).join('|') : null;

  const recover = useCallback(
    (forKey: string) => {
      if (!params) return;
      if (retried.current.has(forKey)) {
        // La borne a déjà servi pour ce jeu de paramètres — dd a reçu un run_id frais et
        // /targets rend 404 quand même. Avant ce champ, ce cas retombait dans le silence : le
        // 404 est exclu du bloc `outage` de la page (il déclenche la récupération, il ne doit
        // pas s'afficher comme une panne), donc rien ne se rendait — une impasse permanente,
        // puisque la ref survit au re-rendu et qu'un rechargement de la page ne change pas le
        // jeu de paramètres dans l'URL.
        setExhaustedKey(forKey);
        return;
      }
      retried.current.add(forKey);
      // `invalidateQueries` (et non `removeQueries`) : le run est un observer ACTIF (monté par
      // `useDdRun` juste au-dessus), donc invalider force son refetch immédiat. `removeQueries`
      // vide le cache mais ne garantit pas qu'un nouvel appel parte aussitôt — la recréation de
      // la query par l'observer et un `refetchQueries` séparé peuvent se rater dans le temps.
      void qc.invalidateQueries({ queryKey: runKey(params) });
    },
    [params, qc],
  );

  useEffect(() => {
    if (!(key && targets.isError && statusOf(targets.error) === 404)) return;
    // `recover` peut appeler `setExhaustedKey` : le mettre dans un callback planifié (et non
    // l'appeler en direct dans le corps de l'effet) évite la cascade de rendu synchrone que
    // `react-hooks/set-state-in-effect` signale — l'effet réagit ici à un système externe (la
    // requête réseau qui vient d'échouer), pas à une valeur dérivable pendant le rendu.
    const timeoutId = setTimeout(() => recover(key), 0);
    return () => clearTimeout(timeoutId);
  }, [key, targets.isError, targets.error, run.data, recover]);

  const exhausted = exhaustedKey !== null && exhaustedKey === key;

  // Réarme la borne pour ce jeu de paramètres puis relance immédiatement — le seul moyen de
  // sortir de l'impasse ci-dessus sans changer de paramètres. Sans le retrait explicite de la
  // clé, `recover` refuserait la nouvelle tentative : elle croirait la borne déjà consommée.
  const reset = useCallback(() => {
    if (!key) return;
    retried.current.delete(key);
    setExhaustedKey((current) => (current === key ? null : current));
    recover(key);
  }, [key, recover]);

  return { ...targets, exhausted, reset };
}

/* ------------------------------------------------------------------ */
/* Mode B — la comparaison de l'utilisateur face au classement          */
/* ------------------------------------------------------------------ */

export interface DdSignaturePreviewParams {
  datasetId: string;
  comparisonName: string;
  padjMax: number;
  logfcMin: number;
  directions: string;
  maxGenesPerCondition: number;
}

/**
 * Ce qui SERAIT envoyé, avant que quoi que ce soit ne parte.
 *
 * N'appelle pas genolens-dd : la route est purement locale. C'est ce qui permet de montrer les
 * comptes de gènes, les noms de conditions résolus et les effectifs de réplicats **avant** que
 * la liste de gènes ne quitte le backend — un run mal réglé coûte alors un coup d'œil et non
 * une transmission.
 */
export function useSignaturePreview(params: DdSignaturePreviewParams | null) {
  return useQuery({
    queryKey: [
      'dd', 'signaturePreview', params?.datasetId, params?.comparisonName,
      params?.padjMax, params?.logfcMin, params?.directions, params?.maxGenesPerCondition,
    ],
    queryFn: async () =>
      (await api.get<DdSignaturePreview>(`${BASE}/signature-preview`, {
        params: {
          dataset_id: params!.datasetId,
          comparison_name: params!.comparisonName,
          padj_max: params!.padjMax,
          logfc_min: params!.logfcMin,
          directions: params!.directions,
          max_genes_per_condition: params!.maxGenesPerCondition,
        },
      })).data,
    enabled: params !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function signatureRunKey(params: DdSignatureRunParams) {
  return [
    'dd', 'signatureRun', params.datasetId, params.comparisonName, params.indication,
    params.profile, params.allowExcluded, params.padjMax, params.logfcMin,
    params.directions, params.maxGenesPerCondition, params.seed,
    params.allowUnderpowered, JSON.stringify(params.replicates),
  ] as const;
}

/**
 * `useQuery` qui émet un POST, pour la même raison que `useDdRun` : avec une graine explicite,
 * un run de signature est une fonction pure de ses paramètres, donc le cacher par paramètres est
 * correct.
 *
 * En revanche — et contrairement au mode A — **rien ne doit partir sans geste de l'utilisateur**.
 * Un run de signature écrit sa liste de gènes dans un autre service ; l'appelant passe `null`
 * tant que le bouton n'a pas été pressé, et c'est `enabled` qui porte cette garantie.
 */
export function useSignatureRun(params: DdSignatureRunParams | null) {
  return useQuery({
    queryKey: params ? signatureRunKey(params) : ['dd', 'signatureRun', 'idle'],
    queryFn: async () => {
      const body = {
        dataset_id: params!.datasetId,
        comparison_name: params!.comparisonName,
        indication: params!.indication,
        profile: params!.profile,
        allow_excluded: params!.allowExcluded,
        padj_max: params!.padjMax,
        logfc_min: params!.logfcMin,
        directions: params!.directions,
        max_genes_per_condition: params!.maxGenesPerCondition,
        replicates: params!.replicates,
        allow_underpowered: params!.allowUnderpowered,
        seed: params!.seed,
      };
      return (await api.post<DdSignatureRunResponse>(`${BASE}/signature-runs`, body)).data;
    },
    enabled: params !== null,
    staleTime: Infinity,
    retry: false,
  });
}

export function useSignatureReport(
  runId: string | undefined,
  signatureId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['dd', 'signatureReport', runId, signatureId],
    queryFn: async () =>
      (await api.get<DdReport>(
        `${BASE}/runs/${runId}/signature/${signatureId}/report`,
      )).data,
    enabled: enabled && Boolean(runId) && Boolean(signatureId),
    retry: false,
  });
}

/**
 * Le run de signature, avec récupération après expiration du run amont.
 *
 * Reprend la machinerie bornée de `useDdTargetsWithRecovery`, y compris ses deux subtilités :
 * la borne est indexée par **jeu de paramètres** et non par `run_id` (amont mint un UUID frais à
 * chaque POST, donc une borne sur `run_id` ne bornerait jamais rien), et le déclenchement vit
 * dans un `useEffect` parce que `recover()` émet un vrai POST.
 *
 * Une différence de fond avec le mode A : ici, réessayer **retransmet la liste de gènes**. La
 * borne à une tentative n'est donc plus seulement une protection contre la boucle de POST, c'est
 * une limite au nombre de fois où les données de l'utilisateur repartent sans qu'il le demande.
 */
export function useSignatureRunWithRecovery(params: DdSignatureRunParams | null) {
  const qc = useQueryClient();
  const attempts = useRef<Map<string, number>>(new Map());
  const [exhaustedKey, setExhaustedKey] = useState<string | null>(null);
  // Compteur en ÉTAT et non seulement en ref : c'est lui qui fait re-tourner l'effet après une
  // tentative de récupération. Le ref reste la source de vérité (il survit à un démontage), mais
  // un ref seul ne notifie jamais React.
  const [attempt, setAttempt] = useState(0);
  const run = useSignatureRun(params);
  const key = params ? signatureRunKey(params).join('|') : null;

  useEffect(() => {
    // Réarme le compteur quand l'utilisateur change de demande : la borne est par jeu de
    // paramètres, pas par session.
    setAttempt(key ? (attempts.current.get(key) ?? 0) : 0);
  }, [key]);

  /**
   * Le déclencheur exige `!isFetching`, et c'est là que tient la correction.
   *
   * Une première version dépendait de l'identité de `run.error` pour re-tourner après la seconde
   * tentative. Ça marche pour le mode A — dont l'effet dépend aussi de `run.data`, qui change à
   * chaque run_id frais — mais pas ici : l'erreur d'un 404 répété peut être le MÊME objet, donc
   * aucune dépendance ne changeait, l'effet ne re-tournait pas, et `exhausted` restait faux pour
   * toujours. L'utilisateur se retrouvait devant une erreur sans bouton de relance.
   *
   * `isFetching` change forcément (true pendant la reprise, false quand elle a échoué), donc le
   * déclencheur ne dépend plus de l'identité de l'erreur. Et l'attendre à `false` évite le
   * symétrique : marquer « épuisé » pendant que la reprise est encore en vol.
   */
  useEffect(() => {
    if (!key || !params) return;
    if (!run.isError || run.isFetching) return;
    if (statusOf(run.error) !== 404) return;

    if (attempt === 0) {
      attempts.current.set(key, 1);
      setAttempt(1);
      void qc.invalidateQueries({ queryKey: signatureRunKey(params) });
      return;
    }
    setExhaustedKey(key);
  }, [key, params, qc, attempt, run.isError, run.isFetching, run.error]);

  const exhausted = exhaustedKey !== null && exhaustedKey === key;

  const reset = useCallback(() => {
    if (!key || !params) return;
    attempts.current.delete(key);
    setAttempt(0);
    setExhaustedKey((current) => (current === key ? null : current));
    void qc.invalidateQueries({ queryKey: signatureRunKey(params) });
  }, [key, params, qc]);

  return { ...run, exhausted, reset };
}
