import type { DriveStep } from 'driver.js';

/**
 * Les ancres d'une visite guidee : lesquelles sont reellement a l'ecran.
 *
 * Un element peut exister dans le DOM sans etre visible. La barre du haut en est
 * l'exemple : `data-tour="nav-workspace"` et `help-button` sont presents a toutes
 * les largeurs, mais `display:none` sous 60rem, ou leurs entrees passent dans le
 * tiroir. driver.js choisit sa cible par `querySelector` : il la trouve, la mesure
 * a 0x0 et pose la bulle dans le coin de la page. Deux consequences :
 *
 *   - `renderedSteps` retire de la visite les etapes dont l'ancre est la sans
 *     etre visible ;
 *   - `isTourReady` fait attendre l'ouverture automatique la premiere ancre
 *     VISIBLE, et non la premiere ancre presente.
 *
 * Une ancre ABSENTE n'est pas « cachee » : elle peut ne pas etre montee encore
 * (donnees en cours de chargement). L'etape est gardee, et l'ouverture automatique
 * attend. Une etape sans ancre, ou ancree par une fonction, est toujours gardee.
 *
 * « Visible » veut dire « a une boite de mise en page » : `getClientRects()` est
 * vide pour `display:none` (sur l'element ou un ancetre), pour l'attribut `hidden`
 * et pour un element detache. jsdom n'a pas de mise en page et la renvoie toujours
 * vide : un test qui veut une ancre visible doit la piloter.
 */

/** L'element occupe-t-il de la place dans la mise en page ? */
export function isAnchorRendered(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/** L'ancre de l'etape (selecteur), si elle en a une. */
function selectorOf(step: DriveStep): string | null {
  return typeof step.element === 'string' ? step.element : null;
}

/**
 * Les etapes a jouer : celles dont l'ancre n'est pas presente-mais-invisible.
 * Ne modifie pas la definition de la visite.
 */
export function renderedSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    const selector = selectorOf(step);
    if (selector === null) return true;
    const el = document.querySelector(selector);
    return el === null || isAnchorRendered(el);
  });
}

/**
 * La visite peut-elle s'ouvrir ? Vrai des que sa premiere etape ancree et
 * VISIBLE est montee. Une ancre presente-mais-invisible est enjambee ; une ancre
 * pas encore montee fait attendre ; une visite sans etape ancree s'ouvre tout de
 * suite. Si toutes les ancres sont invisibles, elle ne s'ouvre jamais.
 */
export function isTourReady(steps: DriveStep[]): boolean {
  const selectors = steps.map(selectorOf).filter((s): s is string => s !== null);
  if (selectors.length === 0) return true;
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el !== null && !isAnchorRendered(el)) continue;
    return el !== null;
  }
  return false;
}
