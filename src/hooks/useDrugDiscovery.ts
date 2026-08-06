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
import { useCallback, useEffect, useRef } from 'react';

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
  const run = useDdRun(params);
  const targets = useTargets(run.data, limit);

  const recover = useCallback(() => {
    if (!params) return;
    const key = runKey(params).join('|');
    if (retried.current.has(key)) return;
    retried.current.add(key);
    // `invalidateQueries` (et non `removeQueries`) : le run est un observer ACTIF (monté par
    // `useDdRun` juste au-dessus), donc invalider force son refetch immédiat. `removeQueries`
    // vide le cache mais ne garantit pas qu'un nouvel appel parte aussitôt — la recréation de
    // la query par l'observer et un `refetchQueries` séparé peuvent se rater dans le temps.
    void qc.invalidateQueries({ queryKey: runKey(params) });
  }, [params, qc]);

  useEffect(() => {
    if (targets.isError && statusOf(targets.error) === 404) {
      recover();
    }
  }, [targets.isError, targets.error, run.data, recover]);

  return targets;
}
