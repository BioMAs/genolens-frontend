'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { clampThresholds, DEFAULT_THRESHOLDS, type VolcanoThresholds } from '@/utils/volcano';

/**
 * Les seuils d'une étude : un réglage par projet, suivi partout où l'on compte des gènes.
 *
 * Avant, chaque écran avait les siens — la page de lecture les lisait dans l'URL, le Venn et le
 * diagramme des gènes les plus régulés portaient `0.05` / `0.58` en dur — et un lecteur qui avait
 * resserré les seuils d'une étude les retrouvait lâches à l'écran suivant. Le réglage vit dans
 * `localStorage['gl-thresholds:<projectId>']` : par navigateur, pas par compte, ce que le backend
 * n'a pas de route pour garder.
 *
 * Tout passe par `clampThresholds`, à la lecture comme à l'écriture : un stockage édité à la main,
 * ou écrit par une autre version, ne peut pas demander plus lâche que ce que l'ingestion a gardé.
 * Un stockage absent, illisible ou bloqué (navigation privée, quota) rend `DEFAULT_THRESHOLDS` et
 * ne lève jamais : le réglage ne survit alors pas au rechargement, la lecture continue.
 *
 * **Hydratation.** Le serveur ne connaît pas le stockage du navigateur : son instantané est
 * `DEFAULT_THRESHOLDS`, et le premier rendu client — l'hydratation — l'est aussi. Le vrai réglage
 * arrive juste après, sans écart. Même mécanisme que `chartPrefs` et `ThemeContext`.
 *
 * **Instantané stable.** `useSyncExternalStore` compare les instantanés par identité : lire le
 * stockage et reparser à chaque appel rendrait un objet neuf à chaque fois, et la page bouclerait.
 * L'instantané est donc gardé par chaîne brute — tant que le stockage dit la même chose, c'est le
 * même objet.
 */

const KEY_PREFIX = 'gl-thresholds:';
const keyOf = (projectId: string) => `${KEY_PREFIX}${projectId}`;

// ── le réglage comme source externe ─────────────────────────────────────────────────────
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Un autre onglet qui règle la même étude doit se refléter ici ; `key === null` : stockage vidé.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(KEY_PREFIX)) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function readRaw(projectId: string): string | null {
  try {
    return window.localStorage.getItem(keyOf(projectId));
  } catch {
    // Lecture impossible : comme s'il n'y avait rien.
    return null;
  }
}

/** Ce que dit une chaîne stockée ; toute forme inattendue vaut « pas de réglage ». */
function parse(raw: string | null): VolcanoThresholds {
  if (raw === null) return DEFAULT_THRESHOLDS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return DEFAULT_THRESHOLDS;
    }
    const { padj, logfc } = parsed as Partial<VolcanoThresholds>;
    // Un seuil qui n'est pas un nombre fini retombe sur le sien par défaut, dans `clampThresholds`.
    return clampThresholds({ padj, logfc });
  } catch {
    return DEFAULT_THRESHOLDS;
  }
}

/** La dernière lecture de chaque étude : la chaîne brute, et ce qu'elle a donné. */
const lastRead = new Map<string, { raw: string | null; value: VolcanoThresholds }>();

function getSnapshot(projectId: string): VolcanoThresholds {
  const raw = readRaw(projectId);
  const cached = lastRead.get(projectId);
  if (cached && cached.raw === raw) return cached.value;
  const value = parse(raw);
  lastRead.set(projectId, { raw, value });
  return value;
}

/** Ce que rend le serveur, et le premier rendu client : voir « Hydratation » plus haut. */
const getServerSnapshot = () => DEFAULT_THRESHOLDS;

function save(projectId: string, thresholds: VolcanoThresholds) {
  try {
    window.localStorage.setItem(keyOf(projectId), JSON.stringify(clampThresholds(thresholds)));
  } catch {
    // Pas de persistance : le réglage ne vaut pas au-delà de ce rendu, la lecture continue.
    return;
  }
  // Les autres lecteurs de l'étude dans cet onglet ; l'évènement `storage`, lui, ne part que vers
  // les autres onglets.
  emit();
}

/**
 * Le réglage de l'étude et de quoi le changer. Le setter est stable pour un projet donné ; écrire
 * deux fois la même valeur ne change pas l'instantané, donc ne refait aucun rendu.
 */
export function useStudyThresholds(
  projectId: string
): [VolcanoThresholds, (thresholds: VolcanoThresholds) => void] {
  const snapshot = useCallback(() => getSnapshot(projectId), [projectId]);
  const thresholds = useSyncExternalStore(subscribe, snapshot, getServerSnapshot);
  const set = useCallback((next: VolcanoThresholds) => save(projectId, next), [projectId]);
  return [thresholds, set];
}
