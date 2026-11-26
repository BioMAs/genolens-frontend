/**
 * Les deux nombres d'un gène que la lecture écrit toujours de la même façon : dans le chapitre des
 * gènes, dans la fiche d'un gène, dans celle d'un processus.
 */

/** `+3.46` / `−2.50` : le signe est écrit, le moins est le vrai (U+2212), pas un trait d'union. */
export function formatLog2fc(x: number): string {
  return `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(2)}`;
}

/**
 * Le padj d'un gène : exponentiel quand il est petit, décimal sinon. Un padj que le serveur a
 * arrondi à zéro reste `0`, pas `0.0e+0`.
 */
export function formatPadj(padj: number): string {
  if (padj === 0) return '0';
  return padj < 0.001 ? padj.toExponential(1) : padj.toFixed(3);
}
