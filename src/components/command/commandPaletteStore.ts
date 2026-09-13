'use client';

import { useSyncExternalStore } from 'react';

/**
 * L'etat d'ouverture de la palette.
 *
 * Source externe plutot que contexte React, pour la meme raison que
 * `chartPrefs` : deux appelants tres eloignes doivent l'ouvrir — la pastille de
 * la barre superieure et le raccourci global — et un fournisseur obligatoire
 * ferait lever tout test qui monte l'un des deux sans l'autre. L'etat n'a ni
 * proprietes ni cycle de vie : il n'a pas besoin de vivre dans React.
 */
let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => open;
/** Fermee au rendu serveur : une palette ouverte a l'hydratation volerait le focus. */
const getServerSnapshot = () => false;

export function openCommandPalette() {
  if (open) return;
  open = true;
  emit();
}

export function closeCommandPalette() {
  if (!open) return;
  open = false;
  emit();
}

export function toggleCommandPalette() {
  open = !open;
  emit();
}

export function useCommandPaletteOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
