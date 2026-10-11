/**
 * Filigrane « DEMO » des exports construits dans le navigateur.
 *
 * Source unique pour les trois sorties : le canvas (PNG des graphiques, Plotly
 * compris), le SVG autonome, et la page HTML des tables. Le PDF serveur porte
 * le sien, pose cote LaTeX ; les CSV n'en portent pas — un filigrane n'a pas de
 * sens dans un fichier de donnees.
 *
 * Un seul calcul de geometrie (`watermarkGeometry`) sert le canvas et le SVG :
 * les deux exports d'un meme graphique portent le meme filigrane, au meme
 * angle et a la meme taille relative.
 */

export const DEMO_WATERMARK_TEXT = 'DEMO';

/** Ligne de pied de page ajoutee aux exports HTML d'un compte demo. */
export const DEMO_EXPORT_FOOTER = 'Generated with a GenoLens demo account';

/**
 * Gris neutre et opacite faible : lisible sur fond clair comme sombre, sans
 * masquer les donnees. Valeurs LITTERALES — un `var()` ne se resout ni sur un
 * canvas ni dans un fichier sorti du document.
 */
const INK = 'rgb(128, 128, 128)';
const OPACITY = 0.18;
const FONT_STACK = 'system-ui, -apple-system, Segoe UI, Helvetica, Arial, sans-serif';

/**
 * Angle et corps du filigrane pour une surface donnee.
 *
 * Il suit la DIAGONALE montante de la surface, quel que soit son format. Le
 * corps est un quart de la diagonale — « DEMO » couvre alors environ 70 % de
 * celle-ci — borne a 60 % du petit cote, pour qu'un graphique tres large et
 * peu haut ne recoive pas des lettres plus hautes que lui.
 */
export function watermarkGeometry(width: number, height: number) {
  const diagonal = Math.hypot(width, height);
  const fontSize = Math.max(1, Math.round(Math.min(diagonal / 4, Math.min(width, height) * 0.6)));
  const angleDeg = -(Math.atan2(height, width) * 180) / Math.PI;
  return { fontSize, angleDeg, cx: width / 2, cy: height / 2 };
}

/** Pose le filigrane sur un canvas deja peint. L'etat du contexte est restaure. */
export function stampCanvas(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const { fontSize, angleDeg, cx, cy } = watermarkGeometry(width, height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.globalAlpha = OPACITY;
  ctx.fillStyle = INK;
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(DEMO_WATERMARK_TEXT, 0, 0);
  ctx.restore();
}

/**
 * Le filigrane en balisage SVG, a placer EN DERNIER dans le document pour qu'il
 * passe au-dessus du trace.
 *
 * Une chaine plutot qu'un noeud : le SVG autonome est assemble en texte
 * (`buildStandaloneSvg`), et il serait vain de construire un noeud pour le
 * re-serialiser aussitot.
 */
export function svgWatermarkMarkup(width: number, height: number): string {
  const { fontSize, angleDeg, cx, cy } = watermarkGeometry(width, height);
  return (
    `<text x="${cx}" y="${cy}" transform="rotate(${angleDeg.toFixed(2)} ${cx} ${cy})" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `font-family="${FONT_STACK}" font-weight="700" font-size="${fontSize}" ` +
    `fill="${INK}" fill-opacity="${OPACITY}" pointer-events="none">${DEMO_WATERMARK_TEXT}</text>`
  );
}

/**
 * Style du filigrane HTML : fixe au centre de la fenetre, donc present sur
 * chaque ecran au defilement et sur chaque page a l'impression.
 */
export const HTML_WATERMARK_CSS = `
        .demo-watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-35deg);
            font: 700 22vw/1 ${FONT_STACK};
            color: ${INK};
            opacity: ${OPACITY};
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
            z-index: 9999;
        }`;

/** Element du filigrane HTML, masque aux technologies d'assistance. */
export const HTML_WATERMARK_MARKUP = `<div class="demo-watermark" aria-hidden="true">${DEMO_WATERMARK_TEXT}</div>`;
