import { readFileSync } from 'node:fs';

/**
 * La coquille : une barre du haut collee, le document qui defile.
 *
 * Deux invariants se perdent sans bruit :
 *
 * 1. `--sticky-top` EST `--topbar-height`, partout. Au-dela de 768px, c'etait
 *    `.app-content` qui defilait et `--sticky-top` valait 0 ; sous 768px, le
 *    document defilait et il valait la hauteur de la barre. La barre du haut est
 *    desormais `sticky` et le document defile a toutes les largeurs : un element
 *    colle sous elle (la carte de selection, un onglet) doit donc compter sa
 *    hauteur, toujours. Une surcharge a 0 le ferait glisser SOUS la barre.
 *
 * 2. Aucun ancetre d'un element `sticky` ne devient un conteneur de defilement.
 *    `overflow-x: hidden` force `overflow-y: auto` : `.app-content` serait alors
 *    le « scroller » le plus proche, il ne defilerait pas, et tout ce qui est
 *    colle dedans ne collerait plus. Le recadrage horizontal passe par `clip`,
 *    qui ne cree pas de conteneur de defilement.
 */
const CSS = readFileSync('src/app/globals.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Le corps d'une regle, par son selecteur exact (premiere occurrence). */
function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = CSS.match(new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`regle introuvable : ${selector}`);
  return match[1];
}

describe('hauteur de la barre et offset des elements colles', () => {
  it('la barre du haut fait 64px', () => {
    expect(CSS).toMatch(/--topbar-height:\s*64px\s*;/);
    expect(CSS.match(/--topbar-height:/g)).toHaveLength(1);
  });

  it('--sticky-top vaut --topbar-height, declare une seule fois', () => {
    const declarations = (CSS.match(/--sticky-top:[^;]*;/g) ?? []).map((d) => d.replace(/\s+/g, ' '));
    expect(declarations).toEqual(['--sticky-top: var(--topbar-height);']);
  });
});

describe('.app-shell', () => {
  it('empile la barre et le contenu dans une colonne qui grandit avec la page', () => {
    const body = rule('.app-shell');
    expect(body).toMatch(/flex-direction:\s*column/);
    expect(body).toMatch(/min-height:\s*100dvh/);
    // Le document defile : ni hauteur fixee ni rognage.
    expect(body).not.toMatch(/(?<![-\w])height:\s*100dvh/);
    expect(body).not.toMatch(/overflow\s*:\s*hidden/);
  });

  it('.app-content ne devient pas un conteneur de defilement', () => {
    const body = rule('.app-content');
    expect(body).not.toMatch(/overflow(?:-y)?\s*:\s*(?:auto|scroll|hidden)/);
    expect(body).not.toMatch(/overflow-x\s*:\s*hidden/);
    expect(body).toMatch(/overflow-x:\s*clip/);
  });
});

describe('la sidebar a disparu de la feuille', () => {
  it('plus de regle de sidebar, de barre de contexte ni de nav-item', () => {
    for (const gone of ['.app-sidebar', '.app-topbar', '.app-main', '.nav-item', '.nav-section-label', '--sidebar-width']) {
      expect(CSS).not.toContain(gone);
    }
  });
});

describe('le tiroir sous 60rem', () => {
  it('est hors ecran ET invisible tant qu’il est ferme, pour que le clavier n’y entre pas', () => {
    const closed = rule('.app-drawer');
    expect(closed).toMatch(/transform:\s*translateX\(-100%\)/);
    expect(closed).toMatch(/visibility:\s*hidden/);
  });

  it('s’affiche quand l’etat est ouvert', () => {
    const open = rule(".app-drawer[data-state='open']");
    expect(open).toMatch(/visibility:\s*visible/);
    expect(open).toMatch(/transform:\s*(?:none|translateX\(0\))/);
  });

  it('disparait a partir de 60rem avec son bouton et son voile', () => {
    expect(CSS).toMatch(
      /@media\s*\(min-width:\s*60rem\)\s*\{[^}]*\.mobile-nav-toggle[^}]*\.app-drawer[^}]*\{\s*display:\s*none/,
    );
  });
});
