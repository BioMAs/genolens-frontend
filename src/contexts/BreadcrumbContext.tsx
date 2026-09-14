'use client';

import * as React from 'react';
import type { Crumb } from '@/lib/navigation/breadcrumbs';

/**
 * Permet a une page d'enrichir son fil d'Ariane avec le vrai nom de l'objet
 * qu'elle affiche — « Skin Study » plutot que « Project ».
 *
 * Pourquoi un contexte et pas des props : `AppShell` est un composant SERVEUR
 * et `TopBar` est client, donc un nom charge cote page ne peut pas transiter
 * par la coquille sans faire basculer tout l'arbre cote client.
 *
 * Un portail vers un `#breadcrumb-slot` a ete envisage et ecarte : fragile lors
 * des transitions de route, et sans equivalent au rendu serveur.
 *
 * Sans surcharge, la TopBar retombe sur `resolveBreadcrumb(pathname)`, qui
 * donne toujours une piste correcte. C'est ce repli qui rend la migration
 * possible route par route plutot qu'en un seul lot.
 */
interface BreadcrumbContextValue {
  override: Crumb[] | null;
  setOverride: (crumbs: Crumb[] | null) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = React.useState<Crumb[] | null>(null);
  const value = React.useMemo(() => ({ override, setOverride }), [override]);
  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

/** Lu par la TopBar. `null` = pas de surcharge, on retombe sur l'URL. */
export function useBreadcrumbOverride(): Crumb[] | null {
  return React.useContext(BreadcrumbContext)?.override ?? null;
}

/**
 * Declare le fil d'Ariane de la page courante.
 *
 * Le nettoyage au demontage est indispensable : sans lui, la piste d'une page
 * quittee survivrait sur la suivante jusqu'a ce que celle-ci en declare une.
 *
 * `crumbs` est serialise pour la dependance de l'effet : les appelants passent
 * un litteral, dont l'identite change a chaque rendu et qui bouclerait sur une
 * comparaison par reference.
 */
export function useSetBreadcrumb(crumbs: Crumb[] | null): void {
  const ctx = React.useContext(BreadcrumbContext);
  const setOverride = ctx?.setOverride;
  const serialised = JSON.stringify(crumbs ?? null);

  React.useEffect(() => {
    if (!setOverride) return;
    setOverride(JSON.parse(serialised) as Crumb[] | null);
    return () => setOverride(null);
  }, [serialised, setOverride]);
}
