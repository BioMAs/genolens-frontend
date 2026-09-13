import {
  buildStandaloneSvg,
  inlineComputedStyles,
  safeFilename,
} from '@/utils/chartExport';

/**
 * L'export d'un graphique.
 *
 * Ce qui est teste ici est ce qui est VERIFIABLE : l'assemblage du document et
 * le figeage du style. Le rendu PNG passe par un canvas, que jsdom n'implemente
 * pas — meme raisonnement que pour Plotly et cytoscape, et meme reponse :
 * pousser la decision dans une fonction pure et mesurer celle-la.
 */

describe('safeFilename', () => {
  it('rend un nom utilisable sur tous les systemes', () => {
    // Les noms de comparaison portent des `/`, des espaces et des accents.
    expect(safeFilename('Treated D14 / Control, femelle')).toBe('Treated_D14_Control_femelle');
  });

  it('ne rend jamais un nom vide', () => {
    // Un `download=""` ouvre le fichier au lieu de l'enregistrer.
    expect(safeFilename('///')).toBe('chart');
    expect(safeFilename('')).toBe('chart');
  });

  it('borne la longueur', () => {
    expect(safeFilename('a'.repeat(400)).length).toBeLessThanOrEqual(120);
  });
});

describe('buildStandaloneSvg', () => {
  const base = { inner: '<circle r="5"/>', width: 640, height: 480, background: '#131720' };

  it('declare les espaces de noms que le document fournissait', () => {
    // Sans `xmlns`, le fichier n'est pas un SVG : il ne s'ouvre nulle part.
    const svg = buildStandaloneSvg(base);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('xmlns:xlink="http://www.w3.org/1999/xlink"');
    expect(svg.startsWith('<?xml')).toBe(true);
  });

  it('peint le fond AVANT le graphique', () => {
    /**
     * Un canvas — et un SVG sans fond — part transparent. Un export en theme
     * sombre sortirait en texte clair sur rien, que tout visualiseur pose sur
     * du blanc. L'ordre compte autant que la presence.
     */
    const svg = buildStandaloneSvg(base);
    const bg = svg.indexOf('<rect');
    const chart = svg.indexOf('<circle');
    expect(bg).toBeGreaterThan(-1);
    expect(bg).toBeLessThan(chart);
    expect(svg).toContain('fill="#131720"');
  });

  it('couvre toute la surface avec le fond', () => {
    const svg = buildStandaloneSvg(base);
    expect(svg).toContain('width="640" height="480" fill="#131720"');
  });

  it("n'emet pas de bloc de style quand aucune police n'a pu etre embarquee", () => {
    expect(buildStandaloneSvg(base)).not.toContain('<style');
  });

  it('embarque les polices avant le contenu quand elles sont disponibles', () => {
    const svg = buildStandaloneSvg({ ...base, fontCss: "@font-face{font-family:'geist';}" });
    expect(svg.indexOf('<style')).toBeLessThan(svg.indexOf('<circle'));
  });
});

describe('inlineComputedStyles', () => {
  /**
   * Le defaut que cette fonction existe pour supprimer : toute la couche
   * graphique est stylee en jetons, et `var()` ne se resout plus une fois le
   * SVG hors du document. Serialise tel quel, il sort SANS AUCUNE COULEUR.
   */
  function svgWith(markup: string): SVGSVGElement {
    const host = document.createElement('div');
    host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`;
    document.body.appendChild(host);
    return host.querySelector('svg')!;
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fige la valeur calculee sur chaque noeud', () => {
    const svg = svgWith('<rect id="bar" style="fill: rgb(26, 130, 127)"/>');
    const clone = inlineComputedStyles(svg);
    expect(clone.querySelector('#bar')!.getAttribute('style')).toContain('fill:rgb(26, 130, 127)');
  });

  it('ne recopie pas un var() non resolu', () => {
    // Un jeton inexistant produirait un attribut invalide dans le fichier.
    const svg = svgWith('<rect id="bar" style="fill: var(--nexistepas)"/>');
    const clone = inlineComputedStyles(svg);
    expect(clone.querySelector('#bar')!.getAttribute('style') ?? '').not.toContain('var(');
  });

  it('laisse la source intacte', () => {
    // L'export ne doit pas modifier le graphique affiche a l'ecran.
    const svg = svgWith('<rect id="bar" style="fill: rgb(1, 2, 3)"/>');
    const before = svg.outerHTML;
    inlineComputedStyles(svg);
    expect(svg.outerHTML).toBe(before);
  });

  it('traite tout l’arbre, pas seulement la racine', () => {
    const svg = svgWith('<g><g><text id="deep" style="fill: rgb(9, 9, 9)">x</text></g></g>');
    const clone = inlineComputedStyles(svg);
    expect(clone.querySelector('#deep')!.getAttribute('style')).toContain('fill:rgb(9, 9, 9)');
  });

  it('conserve les proprietes hors liste blanche', () => {
    // `transform` et `pointer-events` ne sont pas des proprietes de peinture,
    // mais les jeter deplacerait des elements. Seules les declarations a
    // jeton et celles qu'on refige sont retirees.
    const svg = svgWith('<g id="g" style="transform: translate(10px, 0); fill: var(--x)"></g>');
    const style = inlineComputedStyles(svg).querySelector('#g')!.getAttribute('style') ?? '';
    expect(style).toContain('transform');
    expect(style).not.toContain('var(');
  });

  it('conserve la structure du graphique', () => {
    const svg = svgWith('<g class="layer"><rect/><text>a</text></g>');
    const clone = inlineComputedStyles(svg);
    expect(clone.querySelectorAll('rect')).toHaveLength(1);
    expect(clone.querySelector('g')!.getAttribute('class')).toBe('layer');
  });
});
