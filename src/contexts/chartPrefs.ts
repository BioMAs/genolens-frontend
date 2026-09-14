'use client';

import { useSyncExternalStore } from 'react';
import type { PaletteMode } from '@/utils/chartPalettes';

/**
 * Les preferences d'affichage des graphiques — aujourd'hui, le mode daltonisme.
 *
 * Il existait QUATRE mecanismes concurrents :
 *   - un `useViewPreferences()` partage, mais limite a l'explorateur de
 *     comparaison et NON persiste : il repartait a zero a chaque montage ;
 *   - trois `useState(false)` prives, dans PCAPlot, UMAPPlot,
 *     ClusteringAnalysis et DEGClusteringView.
 *
 * Consequence concrete : activer la palette sure sur le nuage de volcan ne
 * l'activait pas sur la PCA d'a cote, et un rechargement perdait le reglage
 * partout. Pour une preference d'ACCESSIBILITE, ce n'est pas un defaut de
 * finition : c'est un defaut de correction. Quelqu'un qui en a besoin doit la
 * re-activer ecran par ecran, a chaque visite.
 *
 * Le mecanisme reprend celui de `ThemeContext`, qui a deja resolu ce probleme
 * exact : source externe + localStorage + synchronisation inter-onglets +
 * instantane stable au rendu serveur. Le raisonnement sur l'hydratation y est
 * ecrit en detail ; il vaut mot pour mot ici.
 *
 * DEUX differences assumees avec `ThemeContext` :
 *
 * 1. Pas de script anti-FOUC. Contrairement au theme, une palette fausse
 *    pendant une image est invisible — les graphiques ne sont pas encore
 *    rendus a ce moment-la.
 *
 * 2. Pas de fournisseur React. `ThemeContext` en a besoin parce qu'il porte un
 *    etat React ; ici l'etat vit dans `localStorage` et les actions sont des
 *    fonctions de module. Un fournisseur n'apporterait rien et couterait cher :
 *    onze fichiers de test montent `ComparisonSelectionProvider` seul, et une
 *    dependance obligatoire les ferait tous lever. Une preference
 *    d'accessibilite doit etre lisible depuis n'importe ou, sans ceremonie.
 */

const STORAGE_KEY = 'chart-colorblind';

export interface ChartPrefs {
  colorblind: boolean;
}

// ── La preference comme source externe ──────────────────────────────────────
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Un autre onglet qui bascule la preference doit se refleter ici : c'est un
  // reglage d'accessibilite, il n'a aucune raison de differer d'un onglet a
  // l'autre.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Repli quand le stockage est indisponible (navigation privee, quota a zero,
 * cookies tiers bloques). La preference ne survit alors pas au rechargement,
 * mais elle reste effective pour la session : desactiver purement la bascule
 * priverait de la palette sure exactement les navigateurs les plus verrouilles.
 */
let memoryValue = false;

function getSnapshot(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // Lecture impossible : l'instantane memoire fait foi.
  }
  return memoryValue;
}

/**
 * Le serveur ne connait pas le stockage du navigateur. Renvoyer `false` rend le
 * premier rendu client identique a celui du serveur ; la vraie valeur arrive
 * juste apres, sans ecart d'hydratation.
 */
const getServerSnapshot = () => false;

/** Bascule la palette sure. Utilisable hors composant. */
export function setColorblind(value: boolean) {
  // Sortir tot preserve l'identite des objets en aval : un re-rendu inutile de
  // Plotly relance une mise en page complete, ce qui se voit sur le volcan.
  if (value === getSnapshot()) return;
  memoryValue = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Pas de persistance, mais la bascule vaut pour la session.
  }
  emit();
}

export function toggleColorblind() {
  setColorblind(!getSnapshot());
}

/** L'etat des preferences. */
export function useChartPrefs(): ChartPrefs {
  const colorblind = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { colorblind };
}

/** Le mode de palette a passer a `getPalette`. */
export function usePaletteMode(): PaletteMode {
  return useChartPrefs().colorblind ? 'colorblind' : 'standard';
}
