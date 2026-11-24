import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

describe('le fil d’Ariane et la mesure des pages', () => {
  /**
   * Le fil d'Ariane est la premiere ligne de `main`, JUSTE AU-DESSUS de la page :
   * son bord gauche doit etre celui du titre. Il prenait la mesure de la barre du
   * haut (1360px, gouttieres de 40px) alors que `.page-container` prend
   * `--measure-default` et `--page-gutter` : a 1440px, 80px contre 152px.
   *
   * Plutot que de recopier 1200px et 2rem dans un composant, on lit les jetons
   * dans la regle de `.page-container` et on exige que la ligne du fil d'Ariane
   * cite les memes : changer la mesure d'une page change celle du fil.
   */
  // Sans les commentaires : celui du composant cite justement 1360px pour dire qu'il ne le prend pas.
  const crumbRow = readFileSync('src/components/shell/PageBreadcrumb.tsx', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('.page-container tient sa mesure et ses gouttieres de jetons', () => {
    const body = rule('.page-container');
    expect(body).toMatch(/max-width:\s*var\(--measure-default\)/);
    expect(body).toMatch(/padding:[^;]*var\(--page-gutter\)/);
  });

  it('la ligne du fil d’Ariane cite la mesure et la gouttiere de .page-container', () => {
    const body = rule('.page-container');
    const measure = body.match(/max-width:\s*var\((--[\w-]+)\)/)?.[1];
    const gutter = body.match(/padding:\s*var\(--[\w-]+\)\s+var\((--[\w-]+)\)/)?.[1];
    expect(measure).toBeDefined();
    expect(gutter).toBeDefined();

    expect(crumbRow).toContain(`max-w-[var(${measure})]`);
    expect(crumbRow).toContain(`px-[var(${gutter})]`);
  });

  it('la ligne du fil d’Ariane ne retombe pas sur la mesure de la barre du haut', () => {
    expect(crumbRow).not.toContain('1360');
    expect(crumbRow).not.toMatch(/\bmd:px-10\b/);
  });

  /**
   * La rangee d'onglets du projet est sous le fil d'Ariane et au-dessus de la
   * meme page : meme mesure, memes gouttieres, donc meme bord gauche. Une rangee a
   * 1360px / 40px decalerait les onglets de 72px a 1440 par rapport au titre.
   */
  it('la rangee d’onglets du projet cite la mesure et la gouttiere de .page-container', () => {
    const projectRow = readFileSync('src/components/project/ProjectNav.tsx', 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    );
    const body = rule('.page-container');
    const measure = body.match(/max-width:\s*var\((--[\w-]+)\)/)?.[1];
    const gutter = body.match(/padding:\s*var\(--[\w-]+\)\s+var\((--[\w-]+)\)/)?.[1];
    expect(measure).toBeDefined();
    expect(gutter).toBeDefined();

    expect(projectRow).toContain(`max-w-[var(${measure})]`);
    expect(projectRow).toContain(`px-[var(${gutter})]`);
    expect(projectRow).not.toContain('1360');
    expect(projectRow).not.toMatch(/\bmd:px-10\b/);
  });
});

describe('les ancres et les elements colles sous la barre du haut', () => {
  /**
   * `scrollIntoView({ block: 'start' })` honore `scroll-margin-top`. Quand
   * `.app-content` defilait, il commencait SOUS une barre non collee : `scroll-mt-6`
   * (24px) suffisait. Le document defile maintenant SOUS une barre collee de 64px :
   * une marge litterale laisse la cible 40px derriere la barre, titre cache.
   *
   * La marge ne s'ecrit donc plus en dur : elle cite `--sticky-top`, la hauteur de
   * la barre. Un decalage de 24px ou de 4rem recopie la valeur d'aujourd'hui, et
   * c'est la qu'elle recommence a deriver le jour ou la barre change.
   */
  const SOURCES: string[] = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((f) => join('src', f))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('__tests__') && !f.includes('lentille-lab'));

  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  /** Un utilitaire de marge de defilement a valeur litterale : scroll-mt-6, scroll-mt-[3rem]… */
  const LITERAL_SCROLL_MARGIN =
    /(?<![\w-])scroll-m[tyb]?-(?!\[calc\(var\(--(?:sticky-top|topbar-height)\))[^\s"'`}]+/g;

  it('aucune marge de defilement litterale (scroll-mt-6…) : elle doit citer --sticky-top', () => {
    const offenders = SOURCES.flatMap((file) =>
      (stripComments(readFileSync(file, 'utf8')).match(LITERAL_SCROLL_MARGIN) ?? []).map(
        (hit) => `${file}: ${hit}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('toute scrollMarginTop en ligne cite --sticky-top ou --topbar-height', () => {
    const offenders = SOURCES.flatMap((file) =>
      [...stripComments(readFileSync(file, 'utf8')).matchAll(/scrollMarginTop:\s*([^,}\n]+)/g)]
        .filter(([, value]) => !/var\(--(?:sticky-top|topbar-height)\)/.test(value))
        .map(([, value]) => `${file}: ${value.trim()}`),
    );
    expect(offenders).toEqual([]);
  });

  it('chaque cible d’un « Go to … » de la page d’analyse porte la marge sur la barre', () => {
    const file = 'src/components/analyses/AnalysisResultsHub.tsx';
    const src = stripComments(readFileSync(file, 'utf8'));
    const targets = [...src.matchAll(/targetId="([\w-]+)"/g)].map((m) => m[1]);
    // Garde-fou du garde-fou : sans cible lue, la boucle ne verifierait rien.
    expect(targets.length).toBeGreaterThanOrEqual(5);

    for (const id of targets) {
      // La balise ouvrante qui porte `id="<id>"` (sur une ou plusieurs lignes).
      const tag = src.match(new RegExp(`<\\w+(?:[^<>]|=>)*?\\bid="${id}"(?:[^<>]|=>)*?>`))?.[0];
      expect(tag).toBeDefined();
      expect(tag).toContain('scroll-mt-[calc(var(--sticky-top)+1rem)]');
    }
  });

  it('temoin positif : le scanner reconnait les marges litterales et laisse passer la bonne', () => {
    for (const bad of ['scroll-mt-6', 'scroll-mt-[4rem]', 'scroll-mt-24', 'scroll-my-2']) {
      expect(bad.match(LITERAL_SCROLL_MARGIN)).not.toBeNull();
    }
    expect('scroll-mt-[calc(var(--sticky-top)+1rem)]'.match(LITERAL_SCROLL_MARGIN)).toBeNull();
    expect('scroll-mt-[calc(var(--topbar-height)+1rem)]'.match(LITERAL_SCROLL_MARGIN)).toBeNull();
  });

  it('temoin positif : les sources sont lues', () => {
    expect(SOURCES.length).toBeGreaterThan(300);
  });
});
