/**
 * Deslug comparison names for better readability
 * Converts underscores and hyphens to spaces, handles common patterns
 */
export function deslugComparisonName(slug: string): string {
  if (!slug) return '';

  // Remove common prefixes (contrast:, log2FoldChange:, etc.)
  let cleaned = slug;
  if (cleaned.includes(':')) {
    cleaned = cleaned.split(':').pop() || slug;
  }

  // Replace underscores and hyphens with spaces
  cleaned = cleaned.replace(/_/g, ' ').replace(/-/g, ' ');

  // Capitalize first letter of each word
  cleaned = cleaned
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Handle common patterns like "vs" -> "vs"
  cleaned = cleaned.replace(/\bVs\b/g, 'vs');

  return cleaned;
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * The low-count filter's sample requirement (`min_reps`), as shown to the user.
 *
 * `value` is either the stored analysis param (a number, or 'auto' before the run resolved it) or
 * the pipeline's QC report value (always a number); `mode` is the report's `min_reps_mode`.
 * Analyses created before the field defaulted to 2.
 */
export function formatMinReps(value: unknown, mode?: unknown): string {
  if (value === 'auto') return 'Auto (smallest compared group)';
  const shown = String(value ?? 2);
  return mode === 'auto' ? `${shown} (auto: smallest compared group)` : shown;
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
