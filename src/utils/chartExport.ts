/**
 * Export d'un graphique SVG en SVG autonome ou en PNG.
 *
 * Deux pieges rendent un export naif inutilisable, et les deux viennent du meme
 * fait : une fois SERIALISE, un SVG n'est plus dans le document.
 *
 * 1. `var()` ne se resout plus. Toute la couche graphique est stylee en jetons
 *    — c'est le choix de conception de `CHART_VARS` — donc un SVG serialise tel
 *    quel sort SANS AUCUNE COULEUR : noir sur transparent. Il faut donc figer
 *    les valeurs CALCULEES, noeud par noeud, avant de serialiser. C'est le meme
 *    pont jeton → litteral que `readChartTheme`, applique a un arbre.
 *
 * 2. Les polices ne suivent pas. Un SVG charge comme IMAGE (ce que fait le
 *    rendu PNG) est un document isole : il ne voit ni les `@font-face` de la
 *    page, ni ses polices deja chargees. Sans embarquement, le PNG retombe sur
 *    une police systeme et les metriques changent — les libelles d'axe se
 *    chevauchent ou se font rogner.
 *
 * Troisieme piege, plus discret : un canvas est TRANSPARENT au depart. Un
 * export en theme sombre donnerait donc du texte clair sur fond transparent,
 * que tout visualiseur affiche sur blanc — illisible. Le fond est peint deux
 * fois, dans le SVG et sur le canvas, pour couvrir les deux sorties.
 */

/**
 * Proprietes figees sur chaque noeud.
 *
 * Liste BLANCHE, et non l'integralite du style calcule : copier tout produit
 * des fichiers de plusieurs megaoctets et, pire, change le rendu — un `<g>`
 * dans un document HTML calcule `display: block`, valeur qui n'a pas le meme
 * sens une fois le SVG autonome.
 */
const PAINTED = [
  'fill', 'fill-opacity', 'fill-rule',
  'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray',
  'stroke-linecap', 'stroke-linejoin',
  'opacity', 'color',
  'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing',
  'text-anchor', 'dominant-baseline', 'paint-order', 'shape-rendering',
  'font-variant-numeric',
] as const;

/**
 * Pile de repli, appliquee APRES la famille resolue. Un SVG ouvert sur une
 * machine qui n'a pas Geist doit rester lisible plutot que de tomber sur la
 * police par defaut du visualiseur.
 */
const FALLBACK_STACK = 'system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif';

export interface ExportOptions {
  /** Nom de fichier, sans extension. Assaini avant usage. */
  filename: string;
  /** Fond peint sous le graphique. Litteral, pas un `var()`. */
  background: string;
  /** Facteur de suréchantillonnage du PNG. 2 par defaut. */
  scale?: number;
}

/** Rend un nom de fichier sur tous les systemes, et jamais vide. */
export function safeFilename(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return cleaned || 'chart';
}

/**
 * Assemble un document SVG autonome.
 *
 * Fonction PURE : c'est elle qui porte les decisions verifiables — declaration
 * XML, espaces de noms, fond peint, repli de police — et elle se teste dans un
 * diff au lieu de s'inspecter dans un visualiseur d'images.
 */
export function buildStandaloneSvg(opts: {
  inner: string;
  width: number;
  height: number;
  background: string;
  fontCss?: string;
}): string {
  const { inner, width, height, background, fontCss } = opts;
  const style = fontCss ? `<style type="text/css">${fontCss}</style>` : '';
  // Le fond est un rect plutot qu'un attribut : il suit ainsi le graphique dans
  // un SVG autonome comme dans le PNG, sans dependre du visualiseur.
  const bg = `<rect x="0" y="0" width="${width}" height="${height}" fill="${background}"/>`;
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    style +
    bg +
    inner +
    '</svg>'
  );
}

/**
 * Clone le graphique en figeant son style calcule.
 *
 * `getComputedStyle` rend la valeur RESOLUE — `rgb(26, 130, 127)` la ou l'auteur
 * a ecrit `var(--chart-up)`. C'est ce qui fait de cette fonction le pont entre
 * les jetons du produit et un fichier qui n'a plus de document.
 */
export function inlineComputedStyles(source: SVGSVGElement): SVGSVGElement {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...Array.from(source.querySelectorAll<Element>('*'))];
  const copies = [clone, ...Array.from(clone.querySelectorAll<Element>('*'))];

  for (let i = 0; i < originals.length; i += 1) {
    const element = originals[i];
    const computed = window.getComputedStyle(element);
    /**
     * Style du parent, pour ne figer que ce qui DIFFERE.
     *
     * Presque toutes ces proprietes sont heritees en SVG : les recopier sur
     * chaque noeud produit un fichier ou 95 % des declarations repetent celle
     * du parent. Sur un nuage de volcan de plusieurs milliers de points, cela
     * fait la difference entre un fichier partageable et un fichier de
     * plusieurs megaoctets.
     *
     * Comparer au PARENT plutot qu'a la valeur initiale est ce qui rend
     * l'omission sure : si les deux coincident, l'heritage redonne exactement
     * la meme valeur. Omettre « ce qui vaut la valeur initiale » serait FAUX
     * des qu'un ancetre impose autre chose.
     */
    const inherited =
      element.parentElement && element !== source
        ? window.getComputedStyle(element.parentElement)
        : null;

    const target = copies[i] as SVGElement;
    const declarations: string[] = [];
    for (const prop of PAINTED) {
      const value = computed.getPropertyValue(prop);
      // `var()` non resolu signifie que le jeton n'existe pas : le laisser
      // passer produirait un attribut invalide, donc on le jette.
      if (!value || value === 'none' || value.includes('var(')) continue;
      if (inherited && inherited.getPropertyValue(prop) === value) continue;
      declarations.push(`${prop}:${value}`);
    }
    /**
     * Le clone a herite l'attribut `style` d'origine, qui peut contenir des
     * `var()` — non resolus une fois hors du document — mais aussi des
     * proprietes hors liste blanche qu'il ne faut PAS perdre (`transform`,
     * `pointer-events`). On retire donc les declarations a jeton et on
     * superpose les valeurs figees, plutot que d'ecraser ou de tout jeter.
     */
    const survivors = (target.getAttribute('style') ?? '')
      .split(';')
      .map((d) => d.trim())
      .filter(
        (d) =>
          d &&
          !d.includes('var(') &&
          !(PAINTED as readonly string[]).includes(d.split(':')[0].trim()),
      );

    const merged = [...survivors, ...declarations].join(';');
    if (merged) target.setAttribute('style', merged);
    else target.removeAttribute('style');
  }
  return clone;
}

/**
 * Recupere les `@font-face` du document pour les embarquer.
 *
 * Best effort, et delibere : un echec ici degrade la police, il ne doit jamais
 * empecher l'export. `cssRules` leve sur une feuille d'une autre origine, et
 * chaque feuille est donc isolee dans son propre try.
 */
export async function collectFontCss(families: string[]): Promise<string> {
  const wanted = families.map((f) => f.toLowerCase().replace(/['"]/g, '').trim()).filter(Boolean);
  if (wanted.length === 0) return '';

  const faces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Feuille d'une autre origine : inaccessible, et ce n'est pas une erreur.
    }
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name !== 'CSSFontFaceRule') continue;
      const fontFace = rule as CSSFontFaceRule;
      const family = fontFace.style
        .getPropertyValue('font-family')
        .toLowerCase()
        .replace(/['"]/g, '')
        .trim();
      if (!wanted.some((w) => w.includes(family) || family.includes(w))) continue;

      const src = fontFace.style.getPropertyValue('src');
      const url = /url\(["']?([^"')]+)["']?\)/.exec(src)?.[1];
      if (!url) continue;
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const buffer = await response.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        const format = url.endsWith('.woff2') ? 'woff2' : 'woff';
        faces.push(
          `@font-face{font-family:'${family}';` +
            `src:url(data:font/${format};base64,${base64}) format('${format}');` +
            `font-weight:${fontFace.style.getPropertyValue('font-weight') || 'normal'};` +
            `font-style:${fontFace.style.getPropertyValue('font-style') || 'normal'};}`,
        );
      } catch {
        // Reseau ou encodage : on se passe de cette fonte.
      }
    }
  }
  return faces.join('');
}

/** Declenche un telechargement. Revoque l'URL : six copies de ce bloc existent. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function measure(svg: SVGSVGElement) {
  const box = svg.getBoundingClientRect();
  const width = Math.round(box.width) || Number(svg.getAttribute('width')) || 800;
  const height = Math.round(box.height) || Number(svg.getAttribute('height')) || 600;
  return { width, height };
}

/** Serialise le graphique en SVG autonome, couleurs et polices figees. */
export async function chartToSvgString(
  svg: SVGSVGElement,
  opts: Omit<ExportOptions, 'scale'>,
): Promise<string> {
  const { width, height } = measure(svg);
  const clone = inlineComputedStyles(svg);
  clone.removeAttribute('style');

  const family = window.getComputedStyle(svg).getPropertyValue('font-family');
  const fontCss = await collectFontCss(family.split(',').map((f) => f.trim()));
  // La pile de repli vient APRES la famille embarquee : si l'embarquement a
  // echoue, le texte reste lisible au lieu de tomber sur la police du lecteur.
  clone.setAttribute('style', `font-family:${family},${FALLBACK_STACK}`);

  return buildStandaloneSvg({
    inner: new XMLSerializer().serializeToString(clone).replace(/^<svg[^>]*>|<\/svg>$/g, ''),
    width,
    height,
    background: opts.background,
    fontCss,
  });
}

export async function exportChartSvg(svg: SVGSVGElement, opts: Omit<ExportOptions, 'scale'>) {
  const markup = await chartToSvgString(svg, opts);
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), `${safeFilename(opts.filename)}.svg`);
}

export async function exportChartPng(svg: SVGSVGElement, opts: ExportOptions) {
  const { width, height } = measure(svg);
  const scale = opts.scale ?? 2;
  const markup = await chartToSvgString(svg, opts);

  const image = new Image();
  image.decoding = 'sync';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Le graphique n’a pas pu être rendu en image.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas indisponible.');
  // Un canvas part TRANSPARENT : sans cette peinture, un export en theme sombre
  // sort en texte clair sur rien, que tout visualiseur pose sur du blanc.
  context.fillStyle = opts.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('L’image n’a pas pu être encodée.');
  downloadBlob(blob, `${safeFilename(opts.filename)}.png`);
}
