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

    /**
     * L'ATTRIBUT de presentation correspondant est retire quand on a fige sa
     * valeur. Il survivait sinon avec son jeton — `stroke="var(--border-subtle)"`
     * a cote d'un `style="stroke:rgb(23, 30, 48)"` qui le neutralise.
     *
     * Le rendu etait correct : une declaration en ligne l'emporte sur un
     * attribut de presentation. Mais ce n'est pas une raison de le garder. Un
     * lecteur y trouve deux valeurs contradictoires, et un optimiseur SVG qui
     * deplace les styles vers les attributs — ce que fait SVGO — rendrait
     * soudain le jeton gagnant, donc la couleur perdue.
     */
    for (const prop of PAINTED) {
      if (declarations.some((d) => d.startsWith(`${prop}:`)) && target.hasAttribute(prop)) {
        target.removeAttribute(prop);
      }
    }

    const merged = [...survivors, ...declarations].join(';');
    if (merged) target.setAttribute('style', merged);
    else target.removeAttribute('style');
  }
  return clone;
}

/**
 * Les polices reellement EMPLOYEES par ce graphique, relevees pendant le
 * parcours de l'arbre : familles, graisses, et les caracteres a couvrir.
 *
 * C'est ce relevé qui rend l'embarquement viable. Sans lui, il faudrait
 * embarquer tout ce que la page declare : 26 `@font-face` et 374 Ko — soit
 * 500 Ko de base64 dans un SVG de graphique.
 */
export interface FontDemand {
  families: Set<string>;
  weights: Set<number>;
  codePoints: Set<number>;
}

export function collectFontDemand(source: SVGSVGElement): FontDemand {
  const demand: FontDemand = { families: new Set(), weights: new Set(), codePoints: new Set() };
  const nodes: Element[] = [source, ...Array.from(source.querySelectorAll('*'))];
  for (const node of nodes) {
    if (!node.textContent) continue;
    const computed = window.getComputedStyle(node);
    for (const family of computed.fontFamily.split(',')) {
      const clean = family.replace(/['"]/g, '').trim().toLowerCase();
      if (clean) demand.families.add(clean);
    }
    const weight = Number.parseInt(computed.fontWeight, 10);
    if (Number.isFinite(weight)) demand.weights.add(weight);
  }
  for (const point of source.textContent ?? '') {
    demand.codePoints.add(point.codePointAt(0)!);
  }
  return demand;
}

/** `U+41`, `U+4??`, `U+400-4FF` — les trois formes qu'une `unicode-range` prend. */
export function parseUnicodeRange(value: string): Array<[number, number]> {
  return value
    .split(',')
    .map((part) => part.trim())
    .map((part): [number, number] | null => {
      const match = /^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f]+))?$/.exec(part);
      if (!match) return null;
      if (match[1].includes('?')) {
        return [
          Number.parseInt(match[1].replace(/\?/g, '0'), 16),
          Number.parseInt(match[1].replace(/\?/g, 'F'), 16),
        ];
      }
      const low = Number.parseInt(match[1], 16);
      return [low, match[2] ? Number.parseInt(match[2], 16) : low];
    })
    .filter((r): r is [number, number] => r !== null);
}

/** `400`, ou `100 900` pour une fonte variable. */
export function parseWeightRange(value: string): [number, number] {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return [400, 400];
  return [numbers[0], numbers[numbers.length - 1]];
}

/**
 * Base64 par tranches.
 *
 * `String.fromCharCode(...octets)` sur une fonte entiere passe a 31 Ko — je
 * l'ai mesure — mais la limite d'arguments depend du moteur et de la taille,
 * et un depassement serait avale par le `catch` : l'export perdrait sa police
 * sans rien dire. Trois lignes suppriment la classe de panne.
 */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Au-dela, l'export cesse d'etre partageable. Backstop, pas budget nominal. */
const FONT_BUDGET_BYTES = 300_000;

/**
 * Recupere les `@font-face` du document pour les embarquer.
 *
 * Best effort, et delibere : un echec ici degrade la police, il ne doit jamais
 * empecher l'export. `cssRules` leve sur une feuille d'une autre origine, et
 * chaque feuille est donc isolee dans son propre try.
 *
 * ── Trois defauts mesures dans la version precedente ────────────────────────
 * 1. L'URL d'une `src` est relative A LA FEUILLE, pas a la page. Next.js emet
 *    `url("../media/xxx.woff2")` depuis `/_next/static/chunks/` : resolue
 *    depuis la page, elle donnait 404, et le `if (!response.ok) continue`
 *    l'avalait. L'embarquement n'a donc JAMAIS fonctionne.
 * 2. Le filtre de famille etait une sous-chaine : `geist` matchait
 *    `__nextjs-Geist`, la police de l'overlay de developpement.
 * 3. Sans filtre de graisse ni de plage de caracteres, il fallait embarquer
 *    tout ce que la page declare. Mesure sur cette application : 26 faces,
 *    374 Ko, ~500 Ko de base64 pour UN graphique.
 */
export async function collectFontCss(demand: FontDemand): Promise<string> {
  if (demand.families.size === 0) return '';

  const faces: string[] = [];
  let budget = FONT_BUDGET_BYTES;

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // Feuille d'une autre origine : inaccessible, et ce n'est pas une erreur.
    }
    for (const rule of Array.from(rules)) {
      if (budget <= 0) break;
      if (rule.constructor.name !== 'CSSFontFaceRule') continue;
      const fontFace = rule as CSSFontFaceRule;

      const family = fontFace.style.getPropertyValue('font-family').replace(/['"]/g, '').trim();
      // Egalite STRICTE : une sous-chaine embarquait la police de l'overlay.
      if (!demand.families.has(family.toLowerCase())) continue;

      const [minWeight, maxWeight] = parseWeightRange(
        fontFace.style.getPropertyValue('font-weight') || '400',
      );
      const weightUsed =
        demand.weights.size === 0 ||
        [...demand.weights].some((w) => w >= minWeight && w <= maxWeight);
      if (!weightUsed) continue;

      const ranges = parseUnicodeRange(fontFace.style.getPropertyValue('unicode-range') || '');
      const covers =
        ranges.length === 0 ||
        [...demand.codePoints].some((p) => ranges.some(([lo, hi]) => p >= lo && p <= hi));
      if (!covers) continue;

      const src = fontFace.style.getPropertyValue('src');
      const raw = /url\(["']?([^"')]+)["']?\)/.exec(src)?.[1];
      if (!raw) continue;

      let url: string;
      try {
        // Une feuille EN LIGNE n'a pas de `href` : on retombe sur le document.
        url = new URL(raw, sheet.href ?? document.baseURI).href;
      } catch {
        continue;
      }

      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > budget) continue;
        budget -= buffer.byteLength;
        const format = url.includes('.woff2') ? 'woff2' : 'woff';
        faces.push(
          `@font-face{font-family:'${family}';` +
            `src:url(data:font/${format};base64,${toBase64(buffer)}) format('${format}');` +
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
  const fontCss = await collectFontCss(collectFontDemand(svg));
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
    image.onerror = () => reject(new Error('The chart could not be rendered as an image.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not available in this browser.');
  // Un canvas part TRANSPARENT : sans cette peinture, un export en theme sombre
  // sort en texte clair sur rien, que tout visualiseur pose sur du blanc.
  context.fillStyle = opts.background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The image could not be encoded.');
  downloadBlob(blob, `${safeFilename(opts.filename)}.png`);
}
