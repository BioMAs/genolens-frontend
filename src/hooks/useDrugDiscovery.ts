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
