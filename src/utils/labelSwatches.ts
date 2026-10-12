/**
 * The colours a user can tag a bookmark or a gene list with.
 *
 * Deliberately literal hex rather than theme tokens: the chosen value is STORED on the bookmark or
 * the list, and must mean the same colour tomorrow and in the other theme — a token would let a
 * theme change recolour someone's labels behind their back.
 *
 * One list for both managers. Each file used to carry its own copy, already formatted
 * differently, and two copies of a palette are one edit away from disagreeing.
 */
export const LABEL_SWATCHES: readonly string[] = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];
