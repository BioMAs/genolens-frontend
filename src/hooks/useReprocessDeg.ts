'use client';

/**
 * Le retraitement DEG d'une comparaison : la requête, le sondage, l'état.
 *
 * Le même geste que `ComparisonDetail` (`handleReprocessDEG`) offrait dans le menu de son en-tête,
 * sorti dans un hook pour la lecture, qui le porte dans la vue « Methods » jusqu'à ce que le lot 4
 * le range dans la page de l'étude. Mêmes requête (`POST /datasets/{id}/reprocess`), sondage
 * (`GET /datasets/{id}` toutes les 5 s, 120 fois au plus), invalidation et messages ; pas de
 * confirmation, l'ancien menu n'en demandait pas.
 *
 * Deux écarts, qui corrigent l'ancien gestionnaire sans changer ce qu'il fait : le sondage
 * s'arrête quand la page s'en va (l'ancien tournait jusqu'à dix minutes après), et un nouveau
 * départ efface le message d'échec du précédent.
 *
 * L'état vit dans la page, pas dans la vue agrandie : fermer puis rouvrir « Methods » pendant un
 * retraitement montre toujours « Reprocessing… ».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '@/utils/api';
import { DatasetStatus } from '@/types';

/** Toutes les 5 s, 10 minutes au plus : les valeurs de `ComparisonDetail`. */
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 120;

export interface ReprocessDeg {
  /** Un retraitement est en cours : le bouton le dit, et n'en lance pas un second. */
  reprocessing: boolean;
  /** Le message du dernier échec, ou `null`. */
  error: string | null;
  start: () => void;
}

export function useReprocessDeg(datasetId: string, projectId: string): ReprocessDeg {
  const queryClient = useQueryClient();
  const [reprocessing, setReprocessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Lu par `start`, qui ne doit pas en relancer un second pendant le premier.
  const running = useRef(false);
  // La page est encore là : un sondage ne démarre pas après son départ.
  const alive = useRef(true);

  const stopPolling = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stopPolling();
    };
  }, [stopPolling]);

  const finish = useCallback(
    (message: string | null) => {
      stopPolling();
      running.current = false;
      setReprocessing(false);
      if (message) setError(message);
    },
    [stopPolling]
  );

  const start = useCallback(() => {
    if (running.current) return;
    running.current = true;
    setReprocessing(true);
    setError(null);

    void (async () => {
      try {
        await api.post(`/datasets/${datasetId}/reprocess`);
      } catch (err) {
        console.error('Failed to reprocess dataset:', err);
        finish('Failed to start heatmap regeneration');
        return;
      }
      if (!alive.current) return;

      let polls = 0;
      timer.current = setInterval(async () => {
        try {
          polls += 1;
          const response = await api.get(`/datasets/${datasetId}`);
          if (response.data.status === DatasetStatus.READY) {
            // Tous les écrans qui lisent les jeux du projet partagent cette requête.
            void queryClient.invalidateQueries({ queryKey: ['datasets', 'project', projectId] });
            finish(null);
          } else if (response.data.status === DatasetStatus.FAILED) {
            finish('Heatmap regeneration failed');
          } else if (polls >= MAX_POLLS) {
            finish('Heatmap regeneration timed out after 10 minutes');
          }
        } catch (err: unknown) {
          // Comme l'ancien sondage : un délai dépassé n'est pas un échec du retraitement.
          const code = (err as { code?: string } | null)?.code;
          if (code !== 'ECONNABORTED') console.error('Polling error:', err);
        }
      }, POLL_INTERVAL_MS);
    })();
  }, [datasetId, projectId, queryClient, finish]);

  // Un objet stable tant que rien ne change : la page le met dans un contexte mémoïsé.
  return useMemo(() => ({ reprocessing, error, start }), [reprocessing, error, start]);
}
