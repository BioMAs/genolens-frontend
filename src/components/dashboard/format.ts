/**
 * Formats partages par les blocs du dashboard. Un seul endroit pour dire
 * « 3h ago » ou « Treated vs Control », sinon chaque bloc invente le sien.
 */

/** Date relative courte : « just now », « 12m ago », « 3h ago », « Yesterday », « 5d ago », « Oct 2 ». */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  const ms = now.getTime() - then.getTime();
  if (Number.isNaN(ms)) return '—';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** « Treated_vs_Control » → « Treated vs Control ». */
export function comparisonTitle(name: string): string {
  return name.replace(/_?vs_?/i, ' vs ').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
